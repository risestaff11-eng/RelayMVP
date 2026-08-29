import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authSessions, passwordResetAttempts, userRoles, users } from "../../../../db/schema";
import { hashPassword } from "../../../../lib/account-auth";
import { sameOrigin } from "../../company/_utils";

function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits;
}

async function resetKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as { email?: unknown; phone?: unknown; password?: unknown };
    const email = String(payload.email ?? "").trim().toLowerCase();
    const phone = normalizePhone(payload.phone);
    const password = String(payload.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Укажите корректный email");
    if (phone.length < 10) throw new Error("Укажите телефон, который вводили при регистрации");
    if (!/^(?=.*[A-Za-z])[\x20-\x7E]{8,}$/.test(password)) throw new Error("Новый пароль: минимум 8 символов и хотя бы одна латинская буква");

    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const keyHash = await resetKey(`${email}|${ip}`);
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const db = getDb();
    const recent = await db.select({ id: passwordResetAttempts.id }).from(passwordResetAttempts)
      .where(and(eq(passwordResetAttempts.keyHash, keyHash), gte(passwordResetAttempts.createdAt, windowStart)));
    if (recent.length >= 5) return Response.json({ error: "Слишком много попыток. Повторите через час или напишите в поддержку." }, { status: 429 });

    const rows = await db.select({ id: users.id, phone: users.phone, status: users.status }).from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
      .where(eq(users.email, email)).limit(1);
    const user = rows[0];
    const matches = Boolean(user && user.status !== "blocked" && normalizePhone(user.phone) === phone);
    await db.insert(passwordResetAttempts).values({ id: crypto.randomUUID(), keyHash, successful: matches, createdAt: new Date().toISOString() });
    if (!matches || !user) return Response.json({ error: "Email и телефон не совпали с данными регистрации. Проверьте ввод или напишите в поддержку." }, { status: 400 });

    const now = new Date().toISOString();
    await db.batch([
      db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: now }).where(eq(users.id, user.id)),
      db.delete(authSessions).where(eq(authSessions.userId, user.id)),
    ]);
    return Response.json({ ok: true, status: user.status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось изменить пароль" }, { status: 400 });
  }
}
