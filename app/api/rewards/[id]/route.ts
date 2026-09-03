import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { rewards } from "../../../../db/schema";
import { sameOrigin } from "../../company/_utils";
import { notifyAgentWorkChanges } from "../../../../lib/agent-work-notifications";

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
  const paid = payload.paid === true;
  const now = new Date().toISOString();
  await getDb().update(rewards).set({ status: paid ? "PAID" : "APPROVED", paidAt: paid ? now : null, partnerConfirmedAt: paid ? row.partnerConfirmedAt : null, updatedAt: now }).where(eq(rewards.id, id));
  if (row.status !== (paid ? "PAID" : "APPROVED")) await notifyAgentWorkChanges(company.id, [row.submissionId]);
  return Response.json({ ok: true, status: paid ? "PAID" : "APPROVED", paidAt: paid ? now : null, partnerConfirmedAt: paid ? row.partnerConfirmedAt : null });
}
