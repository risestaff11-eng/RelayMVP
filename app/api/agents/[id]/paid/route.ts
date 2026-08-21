import { and, eq, inArray, or } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { partners, rewards } from "../../../../../db/schema";
import { sameOrigin } from "../../../company/_utils";

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
  const paid = payload.paid === true;
  const statuses = paid ? ["APPROVED"] : ["PAID"];
  const now = new Date().toISOString();
  await getDb().update(rewards).set({ status: paid ? "PAID" : "APPROVED", paidAt: paid ? now : null, updatedAt: now }).where(and(inArray(rewards.partnerId, related.map((item) => item.id)), inArray(rewards.status, statuses)));
  return Response.json({ ok: true });
}
