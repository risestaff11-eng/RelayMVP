import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userRoles, users } from "../../../../db/schema";
import { createAuthSession, verifyPassword } from "../../../../lib/account-auth";
import { companyReturnTo } from "../../../../lib/auth-navigation";
import { sameOrigin } from "../../company/_utils";
import { limitAuthentication, requestLimitResponse } from "../../../../lib/request-rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return Response.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  try { await limitAuthentication(request, "login", email); }
  catch (error) { return requestLimitResponse(error) ?? Response.json({ error: "Вход временно недоступен" }, { status: 503 }); }
  const rows = await getDb().select({ id: users.id, passwordHash: users.passwordHash, status: users.status }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .where(sql`lower(trim(${users.email})) = ${email}`).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "Неверный email или пароль" }, { status: 401 });
  if (user.status === "pending") return Response.json({ code: "EMAIL_VERIFICATION_REQUIRED", error: "Подтвердите email, чтобы открыть кабинет." }, { status: 403 });
  if (user.status === "blocked") return Response.json({ error: "Доступ к аккаунту ограничен." }, { status: 403 });
  if (user.status !== "active") return Response.json({ error: "Вход в аккаунт недоступен." }, { status: 403 });
  await createAuthSession(user.id);
  return Response.json({ ok: true, redirectTo: companyReturnTo(payload.returnTo) });
}
