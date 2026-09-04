import { and, eq, inArray, or } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { partners, rewards } from "../../../../../db/schema";
import { sameOrigin } from "../../../company/_utils";
import { notifyAgentWorkChanges } from "../../../../../lib/agent-work-notifications";
import { recordRewardTransfer } from "../../../../../lib/reward-transfer";
import { deferIntegrationEvent, recordIntegrationEvent } from "../../../../../lib/integrations/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const agent = (await getDb().select().from(partners).where(and(eq(partners.id, id), eq(partners.companyId, company.id))).limit(1))[0];
  if (!agent) return Response.json({ error: "Агент не найден" }, { status: 404 });
  const related = await getDb().select({ id: partners.id }).from(partners).where(and(eq(partners.companyId, company.id), agent.userId ? or(eq(partners.userId, agent.userId), eq(partners.email, agent.email)) : eq(partners.email, agent.email)));
  const payload = await request.json() as { paid?: boolean };
  if (typeof payload.paid !== "boolean") return Response.json({ error: "Укажите действие с выплатой" }, { status: 400 });
  const paid = payload.paid === true;
  const statuses = paid ? ["APPROVED"] : ["PAID"];
  const rows = await getDb().select({ id: rewards.id }).from(rewards).where(and(eq(rewards.companyId, company.id), inArray(rewards.partnerId, related.map((item) => item.id)), inArray(rewards.status, statuses)));
  const changed: string[] = [];
  for (const row of rows) {
    const result = await recordRewardTransfer(company.id, row.id, paid);
    if (result) {
      changed.push(result.submission_id);
      deferIntegrationEvent(recordIntegrationEvent({ companyId: company.id, eventType: "reward.updated", aggregateType: "reward", aggregateId: row.id, payload: { rewardId: row.id, submissionId: result.submission_id, status: paid ? "PAID" : "APPROVED", source: "BULK_AGENT_ACTION" } }));
    }
  }
  await notifyAgentWorkChanges(company.id, changed);
  return Response.json({ ok: true, changed: changed.length, skipped: rows.length - changed.length });
}
