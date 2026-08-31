import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { agentApplications } from "../../../../db/schema";
import { normalizeAgentEmail, normalizeAgentPhone } from "../../../../lib/agent-auth";
import { sendAgentApplicationNotification } from "../../../../lib/agent-email";
import { cleanString, sameOrigin } from "../../company/_utils";

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => cleanString(item, 80)).filter(Boolean).slice(0, 10) : [];
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const application = {
      name: cleanString(payload.name, 120), email: normalizeAgentEmail(payload.email), phone: normalizeAgentPhone(payload.phone), city: cleanString(payload.city, 100),
      industries: list(payload.industries), experience: cleanString(payload.experience, 1200), network: cleanString(payload.network, 1200), preferredTypes: list(payload.preferredTypes), availability: cleanString(payload.availability, 240), comment: cleanString(payload.comment, 1200),
    };
    if (application.name.length < 2) throw new Error("Укажите имя");
    if (!/^\S+@\S+\.\S+$/.test(application.email)) throw new Error("Укажите корректный email");
    if (application.phone.length < 10) throw new Error("Укажите корректный телефон");
    if (!application.city || !application.industries.length || !application.network) throw new Error("Заполните город, сферы и кого вы можете рекомендовать");
    if (payload.acceptedTerms !== true) throw new Error("Примите политику конфиденциальности");
    const db = getDb();
    const recent = (await db.select().from(agentApplications).where(and(eq(agentApplications.email, application.email), eq(agentApplications.phone, application.phone), gte(agentApplications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()))).orderBy(desc(agentApplications.createdAt)).limit(1))[0];
    if (recent) return Response.json({ ok: true, duplicate: true });
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(agentApplications).values({ id, name: application.name, email: application.email, phone: application.phone, city: application.city, industriesJson: JSON.stringify(application.industries), experience: application.experience, network: application.network, preferredTypesJson: JSON.stringify(application.preferredTypes), availability: application.availability, comment: application.comment, status: "NEW", createdAt: now, updatedAt: now });
    let emailSent = true;
    try { await sendAgentApplicationNotification(application); } catch (error) { emailSent = false; console.error("Agent application notification failed", error); }
    return Response.json({ ok: true, emailSent }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось отправить заявку" }, { status: 400 });
  }
}
