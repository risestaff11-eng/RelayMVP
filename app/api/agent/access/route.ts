import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { findAgentPartners } from "../../../../db/agent-access";
import { agentLoginCodes } from "../../../../db/schema";
import { createAgentSession, normalizeAgentEmail, normalizeAgentPhone } from "../../../../lib/agent-auth";
import { sendAgentLoginCode } from "../../../../lib/agent-email";
import { createVerificationCode, hashVerificationCode } from "../../../../lib/verification-code";
import { cleanString, sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = cleanString(payload.action, 20).toUpperCase();
    const email = normalizeAgentEmail(payload.email);
    const phone = normalizeAgentPhone(payload.phone);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Укажите корректный email");
    if (phone.length < 10) throw new Error("Укажите корректный номер телефона");
    const identity = `${email}:${phone}`;
    const db = getDb();

    if (action === "REQUEST") {
      const matched = await findAgentPartners(email, phone);
      if (!matched.length) return Response.json({ needsApplication: true });
      const recent = await db.select({ count: sql<number>`count(*)` }).from(agentLoginCodes).where(and(
        eq(agentLoginCodes.email, email), eq(agentLoginCodes.phone, phone),
        gte(agentLoginCodes.createdAt, new Date(Date.now() - 15 * 60 * 1000).toISOString()),
      ));
      if (Number(recent[0]?.count ?? 0) >= 5) throw new Error("Слишком много запросов. Попробуйте через 15 минут");
      const code = createVerificationCode();
      await sendAgentLoginCode(email, code);
      const now = new Date();
      await db.insert(agentLoginCodes).values({ id: crypto.randomUUID(), email, phone, codeHash: await hashVerificationCode(identity, "AGENT_LOGIN", code), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), createdAt: now.toISOString() });
      return Response.json({ codeSent: true, maskedEmail: email.replace(/^(.{2}).*(@.*)$/, "$1***$2") });
    }

    if (action === "VERIFY") {
      const code = cleanString(payload.code, 6);
      if (!/^\d{6}$/.test(code)) throw new Error("Введите шестизначный код");
      const verification = (await db.select().from(agentLoginCodes).where(and(eq(agentLoginCodes.email, email), eq(agentLoginCodes.phone, phone), isNull(agentLoginCodes.consumedAt))).orderBy(desc(agentLoginCodes.createdAt)).limit(1))[0];
      if (!verification || new Date(verification.expiresAt).getTime() < Date.now()) throw new Error("Код истёк. Запросите новый");
      if (verification.attempts >= 5) throw new Error("Лимит попыток исчерпан. Запросите новый код");
      if (verification.codeHash !== await hashVerificationCode(identity, "AGENT_LOGIN", code)) {
        await db.update(agentLoginCodes).set({ attempts: sql`${agentLoginCodes.attempts} + 1` }).where(eq(agentLoginCodes.id, verification.id));
        throw new Error("Неверный код");
      }
      const matched = await findAgentPartners(email, phone);
      if (!matched.length) return Response.json({ needsApplication: true });
      const now = new Date().toISOString();
      await db.update(agentLoginCodes).set({ consumedAt: now }).where(eq(agentLoginCodes.id, verification.id));
      await createAgentSession(email, phone);
      return Response.json({ ok: true, redirect: "/agent" });
    }
    throw new Error("Неизвестное действие");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить вход" }, { status: 400 });
  }
}

