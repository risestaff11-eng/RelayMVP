import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { companies, users } from "../../../../../db/schema";
import { deleteCompanyUser } from "../../../../../db/admin";
import { hasAdminSession } from "../../../../../lib/account-auth";
import { sameOrigin } from "../../../company/_utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json() as { status?: string; tokenAmount?: number };
  const now = new Date().toISOString();
  if (payload.status) {
    if (!["pending", "active", "blocked"].includes(payload.status)) return Response.json({ error: "Некорректный статус" }, { status: 400 });
    await getDb().update(users).set({ status: payload.status, updatedAt: now }).where(eq(users.id, id));
  }
  let tokenBalance: number | undefined;
  if (payload.tokenAmount !== undefined) {
    const tokenAmount = Math.round(Number(payload.tokenAmount));
    if (!Number.isFinite(tokenAmount) || tokenAmount < 1 || tokenAmount > 10_000_000) return Response.json({ error: "Введите от 1 до 10 000 000 токенов" }, { status: 400 });
    const company = (await getDb().select({ id: companies.id, aiTokenBalance: companies.aiTokenBalance }).from(companies).where(eq(companies.ownerUserId, id)).limit(1))[0];
    if (!company) return Response.json({ error: "У пользователя нет компании" }, { status: 404 });
    tokenBalance = company.aiTokenBalance + tokenAmount;
    await getDb().update(companies).set({ aiTokenBalance: tokenBalance, updatedAt: now }).where(eq(companies.id, company.id));
  }
  if (!payload.status && payload.tokenAmount === undefined) return Response.json({ error: "Нет изменений" }, { status: 400 });
  return Response.json({ ok: true, tokenBalance });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  await deleteCompanyUser(id);
  return Response.json({ ok: true });
}
