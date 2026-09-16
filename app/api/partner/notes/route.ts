import { and, eq, gte } from "drizzle-orm";
import { getDb, getD1 } from "@/db";
import { getPartnerPortal } from "@/db/partner";
import { submissionStatusEvents, submissionAttachments } from "@/db/schema";
import { getFilesBucket } from "@/lib/storage";
import { cleanString, sameOrigin } from "@/app/api/company/_utils";
import { clientAttention } from "@/lib/agent-workspace";
export async function POST(request: Request) {
    if (!sameOrigin(request))
        return Response.json({ error: "Доступ запрещён" }, { status: 403 });
    try {
        const form = await request.formData();
        const p = await getPartnerPortal(cleanString(form.get("token"), 80));
        if (!p)
            return Response.json({ error: "Ссылка недействительна или устарела" }, { status: 401 });
        const s = p.submissions.find(c => c.id === form.get("submissionId"));
        if (!s)
            return Response.json({ error: "Клиент не найден" }, { status: 404 });
        const reminder = form.get("action") === "REMIND";
        const comment = reminder ? "Агент просит проверить срок по заявке или выплате." : cleanString(form.get("comment"), 2400);
        if (comment.length < 3)
            return Response.json({ error: "Добавьте пояснение" }, { status: 400 });
        if (reminder && !clientAttention(s, p.company.payoutSlaDays, p.accessCheckedAt).startsWith("Срок"))
            return Response.json({ error: "Срок ещё не истёк" }, { status: 400 });
        const actorType = reminder ? "PARTNER_REMINDER" : "PARTNER_NOTE";
        const now = new Date().toISOString();
        const db = getDb();
        if (reminder) {
            const result = await getD1().prepare("INSERT INTO submission_status_events (id,submission_id,from_status,to_status,actor_type,comment,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM submission_status_events WHERE submission_id=? AND actor_type='PARTNER_REMINDER' AND created_at>=?)").bind(crypto.randomUUID(), s.id, s.status, s.status, actorType, comment, now, s.id, new Date(Date.now() - 86400000).toISOString()).run();
            return result.meta.changes ? Response.json({ ok: true }) : Response.json({ error: "Напоминание уже отправлено. Повторить можно через 24 часа." }, { status: 429 });
        }
        const recent = await db.select().from(submissionStatusEvents).where(and(eq(submissionStatusEvents.submissionId, s.id), eq(submissionStatusEvents.actorType, actorType), gte(submissionStatusEvents.createdAt, new Date(Date.now() - (reminder ? 86400000 : 10000)).toISOString()))).limit(1);
        if (recent.length)
            return Response.json({ error: reminder ? "Напоминание уже отправлено. Повторить можно через 24 часа." : "Дополнение уже отправлено. Подождите несколько секунд." }, { status: 429 });
        const file = form.get("file");
        let attachment: typeof submissionAttachments.$inferInsert | undefined;
        if (file instanceof File && file.size) {
            if (file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
                return Response.json({ error: "Приложите PDF, JPG, PNG или WEBP до 10 МБ" }, { status: 400 });
            const key = `${p.company.id}/${s.id}/${crypto.randomUUID()}-note`;
            await getFilesBucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
            attachment = { id: crypto.randomUUID(), submissionId: s.id, objectKey: key, fileName: `Дополнение: ${file.name}`.slice(0, 180), mimeType: file.type, size: file.size, createdAt: now };
        }
        const id = reminder ? `reminder:${s.id}:${now.slice(0, 10)}` : crypto.randomUUID();
        const event = db.insert(submissionStatusEvents).values({ id, submissionId: s.id, fromStatus: s.status, toStatus: s.status, actorType, comment, createdAt: now });
        try {
            if (attachment)
                await db.batch([event, db.insert(submissionAttachments).values(attachment)]);
            else
                await event;
        }
        catch (error) {
            if (attachment?.objectKey)
                await getFilesBucket().delete(attachment.objectKey);
            throw error;
        }
        return Response.json({ ok: true });
    }
    catch {
        return Response.json({ error: "Не удалось отправить дополнение. Проверьте текст и файл и повторите." }, { status: 400 });
    }
}
