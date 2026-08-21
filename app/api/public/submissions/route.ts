import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getMissionForPublicSubmission, getPartnerPortal } from "../../../../db/partner";
import { submissionAttachments, submissionStatusEvents, submissions } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanString, sameOrigin } from "../../company/_utils";
import { agentUrl } from "../../../../lib/public-origins";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const form = await request.formData();
    const token = cleanString(form.get("token"), 80);
    const programSlug = cleanString(form.get("programSlug"), 80);
    const missionId = cleanString(form.get("missionId"), 80);
    const contactName = cleanString(form.get("contactName"), 100);
    const contactCompany = cleanString(form.get("contactCompany"), 120);
    const contactEmail = cleanString(form.get("contactEmail"), 180).toLowerCase();
    const contactPhone = cleanString(form.get("contactPhone"), 40);
    const partnerComment = cleanString(form.get("partnerComment"), 1800);
    const externalLinks = cleanString(form.get("externalLinks"), 2000).split(/[\n,]+/).map((value) => value.trim()).filter(Boolean).slice(0, 5);
    const portal = await getPartnerPortal(token);
    if (!portal || !portal.programs.some((item) => item.slug === programSlug)) return Response.json({ error: "Ссылка агента недействительна для этой программы" }, { status: 401 });
    const target = await getMissionForPublicSubmission(programSlug, missionId);
    if (!target || !portal.programs.some((item) => item.id === target.program.id)) return Response.json({ error: "Задание недоступно" }, { status: 404 });
    if (!portal.acceptances.some((item) => item.missionId === missionId && item.status === "ACTIVE")) throw new Error("Сначала возьмите задание");
    if (contactName.length < 2) throw new Error("Укажите имя потенциального клиента");
    if (contactPhone.replace(/\D/g, "").length < 7) throw new Error("Укажите корректный телефон потенциального клиента");
    if (externalLinks.some((value) => { try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } })) throw new Error("Проверьте ссылки в подтверждении результата");

    const db = getDb();
    const duplicateRows = await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.programId, target.program.id), contactEmail ? eq(submissions.contactEmail, contactEmail) : eq(submissions.contactPhone, contactPhone))).limit(1);
    if (duplicateRows.length) return Response.json({ error: "Такой контакт уже закреплён в этой программе. Полные данные существующей рекомендации не раскрываются." }, { status: 409 });
    const submissionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const allFiles = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (allFiles.length > 5) throw new Error("Можно приложить не более 5 файлов");
    const files = allFiles.slice(0, 5);
    if (files.some((file) => file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type))) throw new Error("Можно приложить до 5 файлов PDF, DOC, JPG, PNG или WEBP размером до 10 МБ каждый");
    const attachmentRows: Array<typeof submissionAttachments.$inferInsert> = externalLinks.map((url) => ({ id: crypto.randomUUID(), submissionId, externalUrl: url, fileName: new URL(url).hostname, mimeType: "text/uri-list", size: 0, createdAt: now }));
    const missionPartner = portal.partners.find((item) => item.programId === target.program.id);
    if (!missionPartner) throw new Error("Сначала откройте эту программу по приглашению компании");
    if (files.length) {
      const bucket = getFilesBucket();
      for (const file of files) {
        const objectKey = `${target.company.id}/${submissionId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
        attachmentRows.push({ id: crypto.randomUUID(), submissionId, objectKey, fileName: file.name.slice(0, 180), mimeType: file.type, size: file.size, createdAt: now });
      }
    }
    const submissionStatement = db.insert(submissions).values({ id: submissionId, companyId: target.company.id, programId: target.program.id, missionId, partnerId: missionPartner.id, type: target.mission.type, contactName, contactCompany, contactEmail, contactPhone, payloadJson: JSON.stringify({ partnerComment, externalLinks }), status: "SUBMITTED", createdAt: now, updatedAt: now });
    const eventStatement = db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId, fromStatus: null, toStatus: "SUBMITTED", actorType: "PARTNER", comment: "Рекомендация отправлена компании", createdAt: now });
    if (attachmentRows.length) await db.batch([submissionStatement, eventStatement, db.insert(submissionAttachments).values(attachmentRows)]);
    else await db.batch([submissionStatement, eventStatement]);
    return Response.json({ partnerUrl: agentUrl(`/partner/${token}`), submissionId }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось передать рекомендацию" }, { status: 400 });
  }
}
