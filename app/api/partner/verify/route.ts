import { env } from "cloudflare:workers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { syncPartnerLevel } from "../../../../db/partner-level";
import { getPartnerPortal } from "../../../../db/partner";
import { contactVerificationCodes, partnerProfiles } from "../../../../db/schema";
import { createVerificationCode, hashVerificationCode } from "../../../../lib/verification-code";
import { cleanString, sameOrigin } from "../../company/_utils";

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
      body: JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [destination], subject: "Код подтверждения Relay", html: `<p>Код подтверждения: <strong>${code}</strong></p><p>Он действует 10 минут.</p>` }),
    });
    if (!response.ok) throw new Error("Не удалось отправить код на email");
    return;
  }
  if (!runtime.WHATSAPP_VERIFY_WEBHOOK_URL) throw new Error("Отправка WhatsApp-кодов пока не подключена");
  const response = await fetch(runtime.WHATSAPP_VERIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(runtime.WHATSAPP_VERIFY_WEBHOOK_TOKEN ? { authorization: `Bearer ${runtime.WHATSAPP_VERIFY_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ to: destination, code, message: `Код подтверждения Relay: ${code}. Действует 10 минут.` }),
  });
  if (!response.ok) throw new Error("Не удалось отправить код в WhatsApp");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const token = cleanString(payload.token, 80);
    const action = cleanString(payload.action, 20);
    const channel = cleanString(payload.channel, 20).toUpperCase();
    if (!new Set(["EMAIL", "WHATSAPP"]).has(channel)) throw new Error("Неизвестный канал подтверждения");
    const portal = await getPartnerPortal(token);
    if (!portal) return Response.json({ error: "Ссылка недействительна" }, { status: 401 });
    const destination = channel === "EMAIL" ? portal.partner.email : portal.partner.phone;
    if (channel === "WHATSAPP" && destination.length < 7) throw new Error("Сначала сохраните номер WhatsApp в профиле");
    const db = getDb();

    if (action === "REQUEST") {
      const code = createVerificationCode();
      await deliverCode(channel, destination, code);
      const now = new Date();
      await db.insert(contactVerificationCodes).values({ id: crypto.randomUUID(), partnerId: portal.partner.id, channel, destination, codeHash: await hashVerificationCode(portal.partner.id, channel, code), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), createdAt: now.toISOString() });
      return Response.json({ ok: true, destination });
    }

    if (action === "CONFIRM") {
      const code = cleanString(payload.code, 6);
      if (!/^\d{6}$/.test(code)) throw new Error("Введите шестизначный код");
      const rows = await db.select().from(contactVerificationCodes).where(and(eq(contactVerificationCodes.partnerId, portal.partner.id), eq(contactVerificationCodes.channel, channel), eq(contactVerificationCodes.destination, destination), isNull(contactVerificationCodes.consumedAt))).orderBy(desc(contactVerificationCodes.createdAt)).limit(1);
      const verification = rows[0];
      if (!verification || new Date(verification.expiresAt).getTime() < Date.now()) throw new Error("Код истёк. Запросите новый");
      if (verification.codeHash !== await hashVerificationCode(portal.partner.id, channel, code)) throw new Error("Неверный код");
      const now = new Date().toISOString();
      await db.batch([
        db.update(contactVerificationCodes).set({ consumedAt: now }).where(eq(contactVerificationCodes.id, verification.id)),
        db.update(partnerProfiles).set(channel === "EMAIL" ? { emailVerifiedAt: now, updatedAt: now } : { whatsappVerifiedAt: now, updatedAt: now }).where(eq(partnerProfiles.partnerId, portal.partner.id)),
      ]);
      const level = await syncPartnerLevel(portal.partner.id);
      return Response.json({ ok: true, level });
    }
    throw new Error("Неизвестное действие");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подтвердить контакт" }, { status: 400 });
  }
}
