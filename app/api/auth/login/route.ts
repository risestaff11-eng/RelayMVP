import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userRoles, users } from "../../../../db/schema";
import { createAuthSession, verifyPassword } from "../../../../lib/account-auth";
import { sameOrigin } from "../../company/_utils";

function safeReturnTo(value: unknown) {
  const path = String(value ?? "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const payload = await request.json() as Record<string, unknown>;
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const rows = await getDb().select({ id: users.id, passwordHash: users.passwordHash, status: users.status }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) return Response.json({ error: "Неверный email или пароль" }, { status: 401 });
  if (user.status === "pending") return Response.json({ error: "Ваш аккаунт ожидает подтверждения администратором." }, { status: 403 });
  if (user.status === "blocked") return Response.json({ error: "Доступ к аккаунту ограничен." }, { status: 403 });
  if (user.status !== "active") return Response.json({ error: "Вход в аккаунт недоступен." }, { status: 403 });
  await createAuthSession(user.id);
  return Response.json({ ok: true, redirectTo: safeReturnTo(payload.returnTo) });
}
