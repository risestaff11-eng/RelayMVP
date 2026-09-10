import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { timingSafeEqual } from "../../../../lib/secure-compare";
import { getDb } from "../../../../db";
import { companyEmailVerificationCodes, marketingEvents, pendingCompanyRegistrations, userRoles, users } from "../../../../db/schema";
import { createAuthSession } from "../../../../lib/account-auth";
import { companyReturnTo } from "../../../../lib/auth-navigation";
import { companyEmailCodeExpiresAt, createCompanyEmailCode, hashCompanyEmailCode, sendCompanyEmailCode } from "../../../../lib/company-email-verification";
import { cleanString, sameOrigin } from "../../company/_utils";
import { claimEmailCode } from "../../../../lib/email-code-lifecycle";
import { limitAuthentication, requestLimitResponse } from "../../../../lib/request-rate-limit";

class VerificationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function findCompanyUser(email: string) {
  const db = getDb();
  const rows = await db.select({
    id: users.id,
    email: users.email,
    status: users.status,
    emailVerifiedAt: users.emailVerifiedAt,
    marketingAttributionJson: users.marketingAttributionJson,
  }).from(users)
    .where(sql`lower(trim(${users.email})) = ${email}`)
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  const [companyRole, pending] = await Promise.all([
    db.select({ userId: userRoles.userId }).from(userRoles).where(and(eq(userRoles.userId, user.id), eq(userRoles.role, "COMPANY"))).limit(1),
    db.select().from(pendingCompanyRegistrations).where(eq(pendingCompanyRegistrations.userId, user.id)).limit(1),
  ]);
  if (!companyRole[0] && !pending[0]) return null;
  return { ...user, hasCompanyRole: Boolean(companyRole[0]), pendingRegistration: pending[0] ?? null };
}

function parseAttribution(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const email = cleanString(payload.email, 180).toLowerCase();
    const action = cleanString(payload.action, 20).toUpperCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new VerificationError("Укажите корректный email");
    await limitAuthentication(request, `company-code-${action}`, email);
    const user = await findCompanyUser(email);
    if (!user) throw new VerificationError("Аккаунт с таким email не найден", 404);
    if (user.status === "blocked") throw new VerificationError("Доступ к аккаунту ограничен", 403);
    const db = getDb();

    if (action === "REQUEST") {
      if (user.emailVerifiedAt && user.status === "active" && user.hasCompanyRole && !user.pendingRegistration) {
        return Response.json({ ok: true, alreadyVerified: true });
      }
      const now = new Date();
      const latest = (await db.select({ createdAt: companyEmailVerificationCodes.createdAt })
        .from(companyEmailVerificationCodes)
        .where(and(eq(companyEmailVerificationCodes.userId, user.id), isNull(companyEmailVerificationCodes.consumedAt)))
        .orderBy(desc(companyEmailVerificationCodes.createdAt)).limit(1))[0];
      if (latest && now.getTime() - new Date(latest.createdAt).getTime() < 60_000) {
        throw new VerificationError("Новый код можно запросить через минуту", 429);
      }
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const sentLastHour = (await db.select({ value: count() }).from(companyEmailVerificationCodes)
        .where(and(eq(companyEmailVerificationCodes.destination, email), gte(companyEmailVerificationCodes.createdAt, hourAgo))))[0]?.value ?? 0;
      if (sentLastHour >= 3) throw new VerificationError("Лимит писем исчерпан. Повторите через час или запросите ручную активацию", 429);
      const code = createCompanyEmailCode();
      const id = crypto.randomUUID();
      await db.batch([
        db.update(companyEmailVerificationCodes).set({ consumedAt: now.toISOString() }).where(and(eq(companyEmailVerificationCodes.userId, user.id), isNull(companyEmailVerificationCodes.consumedAt))),
        db.insert(companyEmailVerificationCodes).values({ id, userId: user.id, destination: email, codeHash: await hashCompanyEmailCode(user.id, code), expiresAt: companyEmailCodeExpiresAt(now), createdAt: now.toISOString() }),
      ]);
      try {
        await sendCompanyEmailCode(email, code);
      } catch (error) {
        await db.update(companyEmailVerificationCodes).set({ consumedAt: new Date().toISOString() }).where(eq(companyEmailVerificationCodes.id, id));
        throw error;
      }
      return Response.json({ ok: true });
    }

    if (action === "CONFIRM") {
      const code = cleanString(payload.code, 6);
      if (!/^\d{6}$/.test(code)) throw new VerificationError("Введите шестизначный код");
      const verification = (await db.select().from(companyEmailVerificationCodes)
        .where(and(eq(companyEmailVerificationCodes.userId, user.id), eq(companyEmailVerificationCodes.destination, email)))
        .orderBy(desc(companyEmailVerificationCodes.createdAt), sql`rowid desc`).limit(1))[0];
      if (!verification || verification.consumedAt || new Date(verification.expiresAt).getTime() < Date.now()) throw new VerificationError("Код истёк. Запросите новый");
      if (verification.attempts >= 5) throw new VerificationError("Превышено число попыток. Запросите новый код", 429);
      const expectedHash = await hashCompanyEmailCode(user.id, code);
      if (!timingSafeEqual(verification.codeHash, expectedHash)) {
        await db.update(companyEmailVerificationCodes).set({ attempts: sql`${companyEmailVerificationCodes.attempts} + 1` }).where(eq(companyEmailVerificationCodes.id, verification.id));
        throw new VerificationError(verification.attempts >= 4 ? "Превышено число попыток. Запросите новый код" : "Неверный код");
      }
      const now = new Date().toISOString();
      if (!await claimEmailCode("company_email_verification_codes", verification.id, now)) throw new VerificationError("Код истёк. Запросите новый");
      const pending = user.pendingRegistration;
      const activated = await db.update(users).set(pending ? {
        displayName: pending.displayName,
        phone: pending.phone,
        companyName: pending.companyName,
        passwordHash: pending.passwordHash,
        marketingAttributionJson: pending.marketingAttributionJson,
        emailVerifiedAt: now,
        status: "active",
        updatedAt: now,
      } : { emailVerifiedAt: now, status: "active", updatedAt: now })
        .where(and(eq(users.id, user.id), sql`${users.status} <> 'blocked'`))
        .returning({ id: users.id });
      if (!activated.length) throw new VerificationError("Доступ к аккаунту ограничен", 403);
      if (pending) {
        await db.batch([
          db.insert(userRoles).values({ userId: user.id, role: "COMPANY", createdAt: now }).onConflictDoNothing(),
          db.delete(pendingCompanyRegistrations).where(eq(pendingCompanyRegistrations.userId, user.id)),
        ]);
      }
      const attribution = parseAttribution(pending?.marketingAttributionJson || user.marketingAttributionJson || "{}");
      await db.insert(marketingEvents).values({
        id: crypto.randomUUID(), event: "company_registration_verified", path: "/auth",
        visitId: cleanString(attribution.visitId, 120),
        utmSource: cleanString(attribution.firstUtmSource, 120),
        utmMedium: cleanString(attribution.firstUtmMedium, 120),
        utmCampaign: cleanString(attribution.firstUtmCampaign, 120),
        lastUtmSource: cleanString(attribution.lastUtmSource, 120),
        lastUtmMedium: cleanString(attribution.lastUtmMedium, 120),
        lastUtmCampaign: cleanString(attribution.lastUtmCampaign, 120),
      });
      await createAuthSession(user.id);
      return Response.json({ ok: true, redirectTo: companyReturnTo(payload.returnTo) });
    }

    throw new VerificationError("Неизвестное действие");
  } catch (error) {
    const limited = requestLimitResponse(error); if (limited) return limited;
    const status = error instanceof VerificationError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подтвердить почту" }, { status });
  }
}
