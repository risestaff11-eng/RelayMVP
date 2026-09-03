import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { companyEmailVerificationCodes, userRoles, users } from "../../../../db/schema";
import { hashPassword } from "../../../../lib/account-auth";
import { companyEmailCodeExpiresAt, createCompanyEmailCode, hashCompanyEmailCode, sendCompanyEmailCode } from "../../../../lib/company-email-verification";
import { cleanString, sameOrigin } from "../../company/_utils";
import { limitAuthentication, requestLimitResponse } from "../../../../lib/request-rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const email = cleanString(payload.email, 180).toLowerCase();
    const displayName = cleanString(payload.name, 100);
    const phone = cleanString(payload.phone, 40);
    const companyName = cleanString(payload.company, 120);
    const password = String(payload.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Укажите корректный email");
    if (displayName.length < 2) throw new Error("Укажите имя");
    if (phone.length < 6) throw new Error("Укажите телефон");
    if (!/^(?=.*[A-Za-z])[\x20-\x7E]{8,}$/.test(password)) throw new Error("Пароль должен содержать минимум 8 символов и хотя бы одну латинскую букву");
    if (payload.acceptedTerms !== true || payload.acceptedPrivacy !== true) throw new Error("Необходимо принять условия и согласие на обработку данных");
    await limitAuthentication(request, "register", email);

    const db = getDb();
    const existing = await db.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`).limit(1);
    const user = existing[0];
    if (user) {
      const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
      if (roles.some((role) => role.role === "COMPANY")) return Response.json({
        code: "ACCOUNT_EXISTS",
        nextStep: "LOGIN",
        error: "Аккаунт с этим email уже существует. Войдите или восстановите пароль.",
      }, { status: 409 });
    }
    const userId = user?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    if (user) {
      await db.batch([
        db.insert(userRoles).values({ userId, role: "COMPANY", createdAt: now }),
        db.update(users).set({ displayName, phone, companyName, passwordHash, status: "pending", emailVerifiedAt: null, updatedAt: now }).where(eq(users.id, userId)),
      ]);
    } else {
      await db.batch([
        db.insert(users).values({ id: userId, email, displayName, phone, companyName, passwordHash, status: "pending", emailVerifiedAt: null, createdAt: now, updatedAt: now }),
        db.insert(userRoles).values({ userId, role: "COMPANY", createdAt: now }),
      ]);
    }
    const code = createCompanyEmailCode();
    const verificationId = crypto.randomUUID();
    let verificationSent = false;
    try {
      await db.insert(companyEmailVerificationCodes).values({ id: verificationId, userId, destination: email, codeHash: await hashCompanyEmailCode(userId, code), expiresAt: companyEmailCodeExpiresAt(), createdAt: now });
      await sendCompanyEmailCode(email, code);
      verificationSent = true;
    } catch {
      await db.delete(companyEmailVerificationCodes).where(eq(companyEmailVerificationCodes.id, verificationId));
    }
    return Response.json({ ok: true, verificationSent }, { status: 201 });
  } catch (error) {
    const limited = requestLimitResponse(error); if (limited) return limited;
    if (/unique constraint|idx_users_email_normalized/i.test(String(error) + String((error as { cause?: unknown })?.cause))) return Response.json({ code: "ACCOUNT_EXISTS", nextStep: "LOGIN", error: "Аккаунт с этим email уже существует. Войдите или восстановите пароль." }, { status: 409 });
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать аккаунт" }, { status: 400 });
  }
}
