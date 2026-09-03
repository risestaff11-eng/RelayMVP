import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { rewards } from "../../../../db/schema";
import { sameOrigin } from "../../company/_utils";
import { notifyAgentWorkChanges } from "../../../../lib/agent-work-notifications";
import { recordRewardTransfer } from "../../../../lib/reward-transfer";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const row = (await getDb().select().from(rewards).where(eq(rewards.id, id)).limit(1))[0];
  if (!row || row.companyId !== company.id) return Response.json({ error: "Начисление не найдено" }, { status: 404 });
  const payload = await request.json() as { paid?: boolean };
  if (typeof payload.paid !== "boolean") return Response.json({ error: "Укажите действие с выплатой" }, { status: 400 });
  const paid = payload.paid === true;
  if ((paid && row.status === "PAID") || (!paid && row.status === "APPROVED")) return Response.json({ ok: true, status: row.status, paidAt: row.paidAt, partnerConfirmedAt: row.partnerConfirmedAt });
  const changed = await recordRewardTransfer(company.id, id, paid);
  if (!changed) return Response.json({ error: "Выплата уже изменена или получение подтверждено. Обновите страницу." }, { status: 409 });
  await notifyAgentWorkChanges(company.id, [row.submissionId]);
  const current = (await getDb().select().from(rewards).where(eq(rewards.id, id)).limit(1))[0];
  return Response.json({ ok: true, status: current.status, paidAt: current.paidAt, partnerConfirmedAt: current.partnerConfirmedAt });
}
