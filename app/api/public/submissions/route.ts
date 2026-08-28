import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getMissionForPublicSubmission, getPartnerPortal } from "../../../../db/partner";
import { submissionAttachments, submissionStatusEvents, submissions } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { visibleSubmissionFormFields, type SubmissionFormField } from "../../../../lib/submission-form";
import { cleanString, sameOrigin } from "../../company/_utils";
import { agentUrl } from "../../../../lib/public-origins";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const allowedAudioTypes = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a"]);

function readValue(form: FormData, field: SubmissionFormField) {
  if (field.type === "CHECKBOX") return form.get(`field__${field.id}`) === "yes" ? "Да" : "Нет";
  return cleanString(form.get(`field__${field.id}`), field.type === "TEXTAREA" ? 2400 : 400);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const form = await request.formData();
    const token = cleanString(form.get("token"), 80);
    const programSlug = cleanString(form.get("programSlug"), 80);
    const missionId = cleanString(form.get("missionId"), 80);
    const portal = await getPartnerPortal(token);
    if (!portal || !portal.programs.some((item) => item.slug === programSlug)) return Response.json({ error: "Ссылка агента недействительна для этой программы" }, { status: 401 });
    const target = await getMissionForPublicSubmission(programSlug, missionId);
    if (!target || !portal.programs.some((item) => item.id === target.program.id)) return Response.json({ error: "Задание недоступно" }, { status: 404 });
    if (!portal.acceptances.some((item) => item.missionId === missionId && item.status === "ACTIVE")) throw new Error("Сначала возьмите задание");

    const fields = visibleSubmissionFormFields(target.program.formFields, target.mission.type);
    const values = new Map(fields.map((field) => [field.id, readValue(form, field)]));
    for (const field of fields) {
      const value = values.get(field.id) || "";
      const files = form.getAll(`file__${field.id}`).filter((item): item is File => item instanceof File && item.size > 0);
      if (field.required && field.type === "FILE" && files.length === 0) throw new Error(`Прикрепите файл: «${field.label}»`);
      if (field.required && field.type !== "FILE" && (field.type !== "CHECKBOX" ? !value.trim() : value !== "Да")) throw new Error(`Заполните обязательное поле: «${field.label}»`);
      if (field.type === "EMAIL" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`Проверьте email в поле «${field.label}»`);
      if (field.type === "PHONE" && value && value.replace(/\D/g, "").length < 7) throw new Error(`Проверьте телефон в поле «${field.label}»`);
      if (field.type === "URL" && value) { try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { throw new Error(`Проверьте ссылку в поле «${field.label}»`); } }
      if (field.type === "SELECT" && value && !field.options.includes(value)) throw new Error(`Выберите корректный вариант в поле «${field.label}»`);
    }

    const semanticValue = (semantic: SubmissionFormField["semantic"]) => {
      const field = fields.find((item) => item.semantic === semantic);
      return field ? values.get(field.id) || "" : "";
    };
    const contactName = semanticValue("CONTACT_NAME");
    const contactCompany = semanticValue("CONTACT_COMPANY");
    const contactEmail = semanticValue("CONTACT_EMAIL").toLowerCase();
    const contactPhone = semanticValue("CONTACT_PHONE");
    const partnerComment = semanticValue("COMMENT");
    const audioTranscript = cleanString(form.get("audioTranscript"), 8000);
    const audioDurationSeconds = Math.max(0, Math.min(60, Number(form.get("audioDurationSeconds")) || 0));
    const externalLinks = semanticValue("LINKS").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean).slice(0, 5);
    if (externalLinks.some((value) => { try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } })) throw new Error("Проверьте ссылки в подтверждении результата");

    const db = getDb();
    const duplicateConditions = [contactEmail ? eq(submissions.contactEmail, contactEmail) : null, contactPhone ? eq(submissions.contactPhone, contactPhone) : null].filter(Boolean);
    const duplicateRows = duplicateConditions.length ? await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.programId, target.program.id), duplicateConditions.length === 2 ? or(duplicateConditions[0]!, duplicateConditions[1]!) : duplicateConditions[0]!)).limit(1) : [];
    if (duplicateRows.length) return Response.json({ error: "Такой контакт уже закреплён в этой программе. Полные данные существующей рекомендации не раскрываются." }, { status: 409 });

    const allFiles = fields.flatMap((field) => form.getAll(`file__${field.id}`).filter((item): item is File => item instanceof File && item.size > 0).map((file) => ({ field, file })));
    if (allFiles.length > 5) throw new Error("Можно приложить не более 5 файлов");
    if (allFiles.some(({ file }) => file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type))) throw new Error("Можно приложить до 5 файлов PDF, DOC, JPG, PNG или WEBP размером до 10 МБ каждый");
    const voiceValue = form.get("voiceNote");
    const voiceNote = voiceValue instanceof File && voiceValue.size > 0 ? voiceValue : null;
    const voiceMime = voiceNote?.type.split(";", 1)[0].toLowerCase() ?? "";
    if (voiceNote && (voiceNote.size > 10 * 1024 * 1024 || !allowedAudioTypes.has(voiceMime))) throw new Error("Голосовая запись должна быть не больше 10 МБ и в формате WEBM, M4A, MP3, OGG, AAC или WAV");

    const submissionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const attachmentRows: Array<typeof submissionAttachments.$inferInsert> = externalLinks.map((url) => ({ id: crypto.randomUUID(), submissionId, externalUrl: url, fileName: new URL(url).hostname, mimeType: "text/uri-list", size: 0, createdAt: now }));
    const missionPartner = portal.partners.find((item) => item.programId === target.program.id);
    if (!missionPartner) throw new Error("Сначала откройте эту программу по приглашению компании");
    if (allFiles.length) {
      const bucket = getFilesBucket();
      for (const { field, file } of allFiles) {
        const objectKey = `${target.company.id}/${submissionId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
        attachmentRows.push({ id: crypto.randomUUID(), submissionId, objectKey, fileName: `${field.label}: ${file.name}`.slice(0, 180), mimeType: file.type, size: file.size, createdAt: now });
      }
    }
    if (voiceNote) {
      const extension = voiceMime.includes("mp4") || voiceMime.includes("m4a") ? "m4a" : voiceMime.includes("mpeg") || voiceMime.includes("mp3") ? "mp3" : voiceMime.includes("ogg") ? "ogg" : voiceMime.includes("wav") ? "wav" : voiceMime.includes("aac") ? "aac" : "webm";
      const objectKey = `${target.company.id}/${submissionId}/${crypto.randomUUID()}-voice.${extension}`;
      await getFilesBucket().put(objectKey, await voiceNote.arrayBuffer(), { httpMetadata: { contentType: voiceMime } });
      attachmentRows.push({ id: crypto.randomUUID(), submissionId, objectKey, fileName: `Голосовой комментарий.${extension}`, mimeType: voiceMime, size: voiceNote.size, createdAt: now });
    }
    const customAnswers = fields.filter((field) => field.semantic === "CUSTOM").map((field) => ({ fieldId: field.id, label: field.label, type: field.type, value: values.get(field.id) || (field.type === "FILE" ? allFiles.filter((item) => item.field.id === field.id).map((item) => item.file.name) : "") }));
    const submissionStatement = db.insert(submissions).values({ id: submissionId, companyId: target.company.id, programId: target.program.id, missionId, partnerId: missionPartner.id, type: target.mission.type, contactName, contactCompany, contactEmail, contactPhone, payloadJson: JSON.stringify({ partnerComment, externalLinks, customAnswers, audioTranscript, audioDurationSeconds, audioConfirmed: Boolean(audioTranscript) }), status: "SUBMITTED", createdAt: now, updatedAt: now });
    const eventStatement = db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId, fromStatus: null, toStatus: "SUBMITTED", actorType: "PARTNER", comment: "Результат отправлен компании", createdAt: now });
    if (attachmentRows.length) await db.batch([submissionStatement, eventStatement, db.insert(submissionAttachments).values(attachmentRows)]);
    else await db.batch([submissionStatement, eventStatement]);
    return Response.json({ partnerUrl: agentUrl(`/partner/${token}`), submissionId }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось передать результат" }, { status: 400 });
  }
}
