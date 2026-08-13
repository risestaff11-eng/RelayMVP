import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { partners } from "../../../../../db/schema";
import { sameOrigin } from "../../../company/_utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const payload = await request.json() as { status?: string };
  const status = payload.status === "BLOCKED" ? "BLOCKED" : payload.status === "ACTIVE" ? "ACTIVE" : "";
  if (!status) return Response.json({ error: "Некорректный статус агента" }, { status: 400 });
  const agent = (await getDb().select({ id: partners.id }).from(partners).where(and(eq(partners.id, id), eq(partners.companyId, company.id))).limit(1))[0];
  if (!agent) return Response.json({ error: "Агент не найден" }, { status: 404 });
  await getDb().update(partners).set({ status, lastActiveAt: new Date().toISOString() }).where(and(eq(partners.id, id), eq(partners.companyId, company.id)));
  return Response.json({ ok: true, status });
}
