import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { getPartnerPortal } from "@/db/partner";
import { agentDrafts } from "@/db/schema";
import { sameOrigin, cleanString } from "@/app/api/company/_utils";
import { visibleSubmissionFormFields, parseSubmissionFormFields } from "@/lib/submission-form";
const headers = { "Cache-Control": "no-store, private" };
export async function POST(request: Request) {
    if (!sameOrigin(request))
        return Response.json({ error: "Доступ запрещён" }, { status: 403, headers });
    try {
        const input = await request.json() as Record<string, unknown>;
        const p = await getPartnerPortal(cleanString(input.token, 80));
        if (!p)
            return Response.json({ error: "Войдите в кабинет повторно" }, { status: 401, headers });
        const mission = p.missions.find(m => m.id === input.missionId);
        const partner = mission && p.partners.find(a => a.programId === mission.programId);
        if (!mission || !partner)
            return Response.json({ error: "Задание недоступно" }, { status: 404, headers });
        const db = getDb();
        const scope = and(eq(agentDrafts.partnerId, partner.id), eq(agentDrafts.missionId, mission.id));
        await db.delete(agentDrafts).where(and(eq(agentDrafts.partnerId, partner.id), lt(agentDrafts.expiresAt, new Date().toISOString())));
        if (input.action === "READ") {
            const row = (await db.select().from(agentDrafts).where(scope).limit(1))[0];
            return Response.json({ draft: row ? { values: JSON.parse(row.valuesJson), requestId: row.requestId } : null }, { headers });
        }
        if (input.action === "DELETE") {
            await db.delete(agentDrafts).where(scope);
            return Response.json({ ok: true }, { headers });
        }
        if (input.action !== "SAVE" || !input.values || typeof input.values !== "object" || Array.isArray(input.values) || typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId))
            return Response.json({ error: "Некорректный черновик" }, { status: 400, headers });
        const program = p.programs.find(g => g.id === mission.programId)!;
        const fields = visibleSubmissionFormFields(parseSubmissionFormFields(program.submissionFormJson), mission.type);
        const values = Object.fromEntries(fields.filter(f => f.type !== "FILE").map(f => [f.id, f.type === "CHECKBOX" ? (input.values as Record<string, unknown>)[f.id] === true : cleanString((input.values as Record<string, unknown>)[f.id], f.type === "TEXTAREA" ? 2400 : 400)]));
        const row = { partnerId: partner.id, missionId: mission.id, valuesJson: JSON.stringify(values), requestId: input.requestId, expiresAt: new Date(Date.now() + 86400000).toISOString(), updatedAt: new Date().toISOString() };
        await db.insert(agentDrafts).values(row).onConflictDoUpdate({ target: [agentDrafts.partnerId, agentDrafts.missionId], set: row });
        return Response.json({ ok: true }, { headers });
    }
    catch {
        return Response.json({ error: "Не удалось сохранить черновик. Введённые данные остаются в форме." }, { status: 503, headers });
    }
}
