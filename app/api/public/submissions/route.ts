import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getMissionForPublicSubmission } from "../../../../db/partner";
import { partnerAccessLinks, partners, submissionAttachments, submissionStatusEvents, submissions } from "../../../../db/schema";
import { createPartnerToken, hashPartnerToken } from "../../../../lib/partner-token";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanString, sameOrigin } from "../../company/_utils";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const form = await request.formData();
    const programSlug = cleanString(form.get("programSlug"), 80);
    const missionId = cleanString(form.get("missionId"), 80);
    const partnerName = cleanString(form.get("partnerName"), 100);
    const partnerEmail = cleanString(form.get("partnerEmail"), 180).toLowerCase();
    const contactName = cleanString(form.get("contactName"), 100);
    const contactCompany = cleanString(form.get("contactCompany"), 120);
    const contactEmail = cleanString(form.get("contactEmail"), 180).toLowerCase();
    const contactPhone = cleanString(form.get("contactPhone"), 40);
    const partnerComment = cleanString(form.get("partnerComment"), 1800);
    const externalLinks = cleanString(form.get("externalLinks"), 2000).split(/[\n,]+/).map((value) => value.trim()).filter(Boolean).slice(0, 5);
    if (partnerName.length < 2 || !/^\S+@\S+\.\S+$/.test(partnerEmail)) throw new Error("Укажите имя и рабочий email партнёра");
    if (contactName.length < 2 || contactCompany.length < 2) throw new Error("Укажите имя и компанию потенциального клиента");
    if (!contactEmail && !contactPhone) throw new Error("Добавьте рабочий email или телефон лида");
    if (externalLinks.some((value) => { try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } })) throw new Error("Проверьте ссылки в подтверждении результата");

    const target = await getMissionForPublicSubmission(programSlug, missionId);
    if (!target) return Response.json({ error: "Миссия недоступна" }, { status: 404 });
    const db = getDb();
    const duplicateRows = await db.select({ id: submissions.id }).from(submissions).where(and(
      eq(submissions.programId, target.program.id),
      contactEmail ? eq(submissions.contactEmail, contactEmail) : eq(submissions.contactPhone, contactPhone),
    )).limit(1);
    if (duplicateRows.length) return Response.json({ error: "Такой контакт уже закреплён в этой программе. Полные данные существующей рекомендации не раскрываются." }, { status: 409 });

    const existingPartners = await db.select().from(partners).where(and(eq(partners.programId, target.program.id), eq(partners.email, partnerEmail))).limit(1);
    const partnerId = existingPartners[0]?.id ?? crypto.randomUUID();
    const submissionId = crypto.randomUUID();
    const rawToken = createPartnerToken();
    const tokenHash = await hashPartnerToken(rawToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 3);
    if (files.some((file) => file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type))) throw new Error("Можно приложить до 3 файлов PDF, DOC, JPG, PNG или WEBP размером до 10 МБ");

    const attachmentRows: Array<typeof submissionAttachments.$inferInsert> = externalLinks.map((url) => ({ id: crypto.randomUUID(), submissionId, externalUrl: url, fileName: new URL(url).hostname, mimeType: "text/uri-list", size: 0, createdAt: now }));
    if (files.length) {
      const bucket = getFilesBucket();
      for (const file of files) {
        const objectKey = `${target.company.id}/${submissionId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
        attachmentRows.push({ id: crypto.randomUUID(), submissionId, objectKey, fileName: file.name.slice(0, 180), mimeType: file.type, size: file.size, createdAt: now });
      }
    }

    const statements = [];
    if (!existingPartners[0]) statements.push(db.insert(partners).values({ id: partnerId, companyId: target.company.id, programId: target.program.id, name: partnerName, email: partnerEmail, status: "ACTIVE", joinedAt: now, lastActiveAt: now }));
    else statements.push(db.update(partners).set({ name: partnerName, lastActiveAt: now }).where(eq(partners.id, partnerId)));
    statements.push(
      db.insert(partnerAccessLinks).values({ id: crypto.randomUUID(), partnerId, tokenHash, expiresAt, createdAt: now }),
      db.insert(submissions).values({ id: submissionId, companyId: target.company.id, programId: target.program.id, missionId, partnerId, type: target.mission.type, contactName, contactCompany, contactEmail, contactPhone, payloadJson: JSON.stringify({ partnerComment, externalLinks }), status: "SUBMITTED", createdAt: now, updatedAt: now }),
      db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId, fromStatus: null, toStatus: "SUBMITTED", actorType: "PARTNER", comment: "Рекомендация отправлена компании", createdAt: now }),
    );
    if (attachmentRows.length) statements.push(db.insert(submissionAttachments).values(attachmentRows));
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>]);

    const trackingUrl = `${new URL(request.url).origin}/partner/${rawToken}`;
    let emailSent = false;
    const runtime = env as unknown as { RESEND_API_KEY?: string; MAGIC_FROM_EMAIL?: string };
    if (runtime.RESEND_API_KEY && runtime.MAGIC_FROM_EMAIL) {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [partnerEmail], subject: `Ваша рекомендация для ${target.company.name}`, html: `<p>Рекомендация зафиксирована.</p><p><a href="${trackingUrl}">Открыть защищённый кабинет партнёра</a></p><p>Программа: ${escapeHtml(target.company.name)}. Ссылка действует 90 дней.</p>` }) });
      emailSent = response.ok;
    }
    return Response.json({ trackingUrl, submissionId, emailSent }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось передать рекомендацию" }, { status: 400 });
  }
}
