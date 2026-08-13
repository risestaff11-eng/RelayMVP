import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { programs } from "../../../../../db/schema";
import { sameOrigin } from "../../../company/_utils";

const STATUSES = new Set(["ACTIVE", "PAUSED", "ARCHIVED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const payload = await request.json() as { status?: string };
  const status = String(payload.status || "").toUpperCase();
  if (!STATUSES.has(status)) return Response.json({ error: "Некорректный статус программы" }, { status: 400 });
  const current = (await getDb().select().from(programs).where(and(eq(programs.id, id), eq(programs.companyId, company.id))).limit(1))[0];
  if (!current) return Response.json({ error: "Программа не найдена" }, { status: 404 });
  if (status === "ACTIVE" && (!current.payoutTerms || !current.legalTerms)) return Response.json({ error: "Перед запуском заполните правила и условия выплат" }, { status: 400 });
  const now = new Date().toISOString();
  await getDb().update(programs).set({ status, publishedAt: status === "ACTIVE" ? current.publishedAt ?? now : current.publishedAt, updatedAt: now }).where(and(eq(programs.id, id), eq(programs.companyId, company.id)));
  return Response.json({ ok: true, status });
}
