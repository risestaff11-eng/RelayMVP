import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCompanyForUser } from "@/db/company";
import { getDb } from "@/db";
import { submissions, submissionStatusEvents } from "@/db/schema";
import { sameOrigin, cleanString } from "../_utils";
import { hasCompanyPermission, companyPermissionDenied } from "@/lib/company-permissions";
import { subscriptionDenied } from "@/lib/company-subscription";
import { notifyAgentWorkChanges } from "@/lib/agent-work-notifications";
export async function POST(request: Request) {
    if (!sameOrigin(request))
        return Response.json({ error: "Доступ запрещён" }, { status: 403 });
    const user = await getChatGPTUser();
    if (!user)
        return Response.json({ error: "Сначала войдите" }, { status: 401 });
    const company = await getCompanyForUser(user.userId);
    if (!company)
        return Response.json({ error: "Компания не найдена" }, { status: 404 });
    if (!hasCompanyPermission(company.role, "CRM_MANAGE"))
        return companyPermissionDenied();
    const denied = await subscriptionDenied(company.id);
    if (denied)
        return denied;
    try {
        const data = await request.json() as Record<string, unknown>;
        const id = cleanString(data.submissionId, 80);
        const comment = cleanString(data.comment, 2400);
        if (comment.length < 3)
            throw Error();
        const db = getDb();
        const s = (await db.select().from(submissions).where(and(eq(submissions.id, id), eq(submissions.companyId, company.id))).limit(1))[0];
        if (!s)
            return Response.json({ error: "Клиент не найден" }, { status: 404 });
        await db.insert(submissionStatusEvents).values({ id: crypto.randomUUID(), submissionId: s.id, actorType: "COMPANY_REQUEST", fromStatus: s.status, toStatus: s.status, comment, createdAt: new Date().toISOString() });
        await notifyAgentWorkChanges(company.id, [s.id]);
        return Response.json({ ok: true });
    }
    catch {
        return Response.json({ error: "Не удалось отправить запрос уточнения" }, { status: 400 });
    }
}
