import { env } from "cloudflare:workers";
import { timingSafeEqual } from "../../../../lib/secure-compare";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getD1, getDb } from "../../../../db";
import { getPartnerPortal } from "../../../../db/partner";
import { contactVerificationCodes } from "../../../../db/schema";
import { createVerificationCode, hashVerificationCode } from "../../../../lib/verification-code";
import { cleanString, sameOrigin } from "../../company/_utils";
import { CONTACT_CODE_LIMIT, limitContactVerificationIp, readRequestLimit, takeRequestLimit, requireRequestLimit, requestLimitResponse, RequestLimitError } from "../../../../lib/request-rate-limit";

type VerificationEnv = {
  RESEND_API_KEY?: string;
  MAGIC_FROM_EMAIL?: string;
  WHATSAPP_VERIFY_WEBHOOK_URL?: string;
  WHATSAPP_VERIFY_WEBHOOK_TOKEN?: string;
};

async function deliverCode(channel: string, destination: string, code: string) {
  const runtime = env as unknown as VerificationEnv;
  if (channel === "EMAIL") {
    if (!runtime.RESEND_API_KEY || !runtime.MAGIC_FROM_EMAIL) throw new Error("Отправка email-кодов пока не подключена");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [destination], subject: "Код подтверждения RiseStaff", html: `<p>Код подтверждения: <strong>${code}</strong></p><p>Он действует 10 минут.</p>` }),
    });
    if (!response.ok) throw new Error("Не удалось отправить код на email");
    return;
  }
  if (!runtime.WHATSAPP_VERIFY_WEBHOOK_URL) throw new Error("Отправка WhatsApp-кодов пока не подключена");
  const response = await fetch(runtime.WHATSAPP_VERIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(runtime.WHATSAPP_VERIFY_WEBHOOK_TOKEN ? { authorization: `Bearer ${runtime.WHATSAPP_VERIFY_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ to: destination, code, message: `Код подтверждения RiseStaff: ${code}. Действует 10 минут.` }),
  });
  if (!response.ok) throw new Error("Не удалось отправить код в WhatsApp");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    await limitContactVerificationIp(request);
    const payload = await request.json() as Record<string, unknown>;
    const token = cleanString(payload.token, 80);
    const action = cleanString(payload.action, 20).toUpperCase();
    const channel = cleanString(payload.channel, 20).toUpperCase();
    if (!new Set(["EMAIL", "WHATSAPP"]).has(channel)) throw new Error("Неизвестный канал подтверждения");
    const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка недействительна" }, { status: 401 });
    const destination = channel === "EMAIL" ? portal.partner.email : portal.partner.phone;
    if (channel === "WHATSAPP" && destination.length < 7) throw new Error("Сначала сохраните номер WhatsApp в профиле");
    const db = getDb();
    // A refreshed access link, re-issued code or another membership of the same
    // person must not reset their attempt budget. Companies/channels stay separate.
    const limitKey = JSON.stringify([portal.company.id, portal.partner.userId || portal.partner.email.trim().toLowerCase(), channel]);
    const blockedMessage = "Лимит попыток исчерпан. Повторите подтверждение через 15 минут.";

    if (action === "REQUEST") {
      requireRequestLimit(await readRequestLimit("contact-code-confirm", limitKey, CONTACT_CODE_LIMIT), blockedMessage);
      requireRequestLimit(await takeRequestLimit("contact-code-request", limitKey, CONTACT_CODE_LIMIT), "Слишком много запросов кода. Попробуйте через 15 минут.");
      const code = createVerificationCode();
      const now = new Date();
      await db.batch([
        db.update(contactVerificationCodes).set({ consumedAt: now.toISOString() }).where(and(eq(contactVerificationCodes.partnerId, portal.partner.id), eq(contactVerificationCodes.channel, channel), isNull(contactVerificationCodes.consumedAt))),
        db.insert(contactVerificationCodes).values({ id: crypto.randomUUID(), partnerId: portal.partner.id, channel, destination, codeHash: await hashVerificationCode(portal.partner.id, channel, code), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), createdAt: now.toISOString() }),
      ]);
      await deliverCode(channel, destination, code);
      return Response.json({ ok: true, destination });
    }

    if (action === "CONFIRM") {
      const attempt = await takeRequestLimit("contact-code-confirm", limitKey, CONTACT_CODE_LIMIT);
      requireRequestLimit(attempt, blockedMessage);
      const code = cleanString(payload.code, 6);
      if (!/^\d{6}$/.test(code)) throw new Error("Введите шестизначный код");
      const rows = await db.select().from(contactVerificationCodes).where(and(eq(contactVerificationCodes.partnerId, portal.partner.id), eq(contactVerificationCodes.channel, channel), eq(contactVerificationCodes.destination, destination), isNull(contactVerificationCodes.consumedAt))).orderBy(desc(contactVerificationCodes.createdAt)).limit(1);
      const verification = rows[0];
      if (!verification || new Date(verification.expiresAt).getTime() < Date.now()) throw new Error("Код истёк. Запросите новый");
      if (!timingSafeEqual(verification.codeHash, await hashVerificationCode(portal.partner.id, channel, code))) {
        if (attempt.remaining === 0) throw new RequestLimitError(blockedMessage, 429, attempt.retryAfterSeconds);
        throw new Error(`Неверный код. Осталось попыток: ${attempt.remaining}`);
      }
      const now = new Date().toISOString();
      const binding = getD1();
      // Only these hardcoded column names enter SQL. Values are always bound.
      const verifiedColumn = channel === "EMAIL" ? "email_verified_at" : "whatsapp_verified_at";
      const contactColumn = channel === "EMAIL" ? "email" : "phone";
      const confirmed = await binding.batch<{ id: string }>([
        binding.prepare(`UPDATE partner_profiles SET ${verifiedColumn} = ?, updated_at = ? WHERE partner_id = ?
          AND EXISTS (SELECT 1 FROM contact_verification_codes c INNER JOIN partners p ON p.id = c.partner_id
            WHERE c.id = ? AND c.partner_id = ? AND c.channel = ? AND c.destination = ?
            AND c.consumed_at IS NULL AND c.expires_at > ? AND p.${contactColumn} = ?)`)
          .bind(now, now, portal.partner.id, verification.id, portal.partner.id, channel, destination, now, destination),
        // changes() refers to the immediately preceding profile update inside
        // this atomic batch. A replay or concurrently changed contact updates 0
        // profiles and therefore cannot consume/confirm the code successfully.
        binding.prepare("UPDATE contact_verification_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND changes() = 1 RETURNING id")
          .bind(now, verification.id),
      ]);
      if (!confirmed.every((item) => item.success) || !confirmed[1]?.results.length) throw new Error("Код уже использован или контакт изменился. Запросите новый код.");
      return Response.json({ ok: true });
    }
    throw new Error("Неизвестное действие");
  } catch (error) {
    const limited = requestLimitResponse(error);
    if (limited) return limited;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подтвердить контакт" }, { status: 400 });
  }
}
