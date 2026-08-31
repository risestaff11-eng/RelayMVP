import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authSessions, passwordResetAttempts, passwordResetCodes, userRoles, users } from "../../../../db/schema";
import { hashPassword } from "../../../../lib/account-auth";
import { companyEmailCodeExpiresAt, createCompanyEmailCode, sendPasswordResetCode } from "../../../../lib/company-email-verification";
import { hashVerificationCode } from "../../../../lib/verification-code";
import { sameOrigin } from "../../company/_utils";

class ResetError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function resetKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameHash(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function findCompanyUser(email: string) {
  return (await getDb().select({ id: users.id, status: users.status }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .where(eq(users.email, email)).limit(1))[0];
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "REQUEST").trim().toUpperCase();
    const email = String(payload.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ResetError("Укажите корректный email");
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const keyHash = await resetKey(`${email}|${ip}`);
    const db = getDb();
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentAttempts = await db.select({ id: passwordResetAttempts.id }).from(passwordResetAttempts)
      .where(and(eq(passwordResetAttempts.keyHash, keyHash), gte(passwordResetAttempts.createdAt, windowStart)));
    if (recentAttempts.length >= 6) throw new ResetError("Слишком много попыток. Повторите через час или напишите в поддержку.", 429);
    const user = await findCompanyUser(email);

    if (action === "REQUEST") {
      await db.insert(passwordResetAttempts).values({ id: crypto.randomUUID(), keyHash, successful: false, createdAt: new Date().toISOString() });
      if (!user || user.status === "blocked") return Response.json({ ok: true });
      const now = new Date();
      const latest = (await db.select({ createdAt: passwordResetCodes.createdAt }).from(passwordResetCodes)
        .where(and(eq(passwordResetCodes.userId, user.id), isNull(passwordResetCodes.consumedAt)))
        .orderBy(desc(passwordResetCodes.createdAt)).limit(1))[0];
      if (latest && now.getTime() - new Date(latest.createdAt).getTime() < 60_000) throw new ResetError("Новый код можно запросить через минуту", 429);
      const sentLastHour = (await db.select({ value: count() }).from(passwordResetCodes)
        .where(and(eq(passwordResetCodes.destination, email), gte(passwordResetCodes.createdAt, windowStart))))[0]?.value ?? 0;
      if (sentLastHour >= 3) throw new ResetError("Лимит писем исчерпан. Повторите через час.", 429);
      const code = createCompanyEmailCode();
      const id = crypto.randomUUID();
      await db.insert(passwordResetCodes).values({ id, userId: user.id, destination: email, codeHash: await hashVerificationCode(user.id, "PASSWORD_RESET", code), expiresAt: companyEmailCodeExpiresAt(now), createdAt: now.toISOString() });
      try { await sendPasswordResetCode(email, code); }
      catch (error) { await db.delete(passwordResetCodes).where(eq(passwordResetCodes.id, id)); throw error; }
      return Response.json({ ok: true });
    }

    if (action === "CONFIRM") {
      const code = String(payload.code ?? "").replace(/\D/g, "").slice(0, 6);
      const password = String(payload.password ?? "");
      if (!user || user.status === "blocked") throw new ResetError("Код недействителен или истёк");
      if (!/^\d{6}$/.test(code)) throw new ResetError("Введите шестизначный код");
      if (!/^(?=.*[A-Za-z])[\x20-\x7E]{8,}$/.test(password)) throw new ResetError("Новый пароль: минимум 8 символов и хотя бы одна латинская буква");
      const verification = (await db.select().from(passwordResetCodes)
        .where(and(eq(passwordResetCodes.userId, user.id), eq(passwordResetCodes.destination, email), isNull(passwordResetCodes.consumedAt)))
        .orderBy(desc(passwordResetCodes.createdAt)).limit(1))[0];
      if (!verification || new Date(verification.expiresAt).getTime() < Date.now()) throw new ResetError("Код недействителен или истёк");
      if (verification.attempts >= 5) throw new ResetError("Превышено число попыток. Запросите новый код", 429);
      const expectedHash = await hashVerificationCode(user.id, "PASSWORD_RESET", code);
      if (!sameHash(verification.codeHash, expectedHash)) {
        await db.update(passwordResetCodes).set({ attempts: verification.attempts + 1 }).where(eq(passwordResetCodes.id, verification.id));
        throw new ResetError(verification.attempts >= 4 ? "Превышено число попыток. Запросите новый код" : "Неверный код");
      }
      const now = new Date().toISOString();
      await db.batch([
        db.update(passwordResetCodes).set({ consumedAt: now }).where(eq(passwordResetCodes.id, verification.id)),
        db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: now }).where(eq(users.id, user.id)),
        db.delete(authSessions).where(eq(authSessions.userId, user.id)),
        db.insert(passwordResetAttempts).values({ id: crypto.randomUUID(), keyHash, successful: true, createdAt: now }),
      ]);
      return Response.json({ ok: true });
    }

    throw new ResetError("Неизвестное действие");
  } catch (error) {
    const status = error instanceof ResetError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось изменить пароль" }, { status });
  }
}
