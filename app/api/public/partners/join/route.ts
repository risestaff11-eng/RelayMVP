import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { getPublicProgramBySlug } from "../../../../../db/programs";
import { companies, partnerAccessLinks, partnerProfiles, partners } from "../../../../../db/schema";
import { createPartnerToken, hashPartnerToken } from "../../../../../lib/partner-token";
import { cleanString, sameOrigin } from "../../../company/_utils";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const slug = cleanString(payload.programSlug, 80);
    const name = cleanString(payload.name, 100);
    const email = cleanString(payload.email, 180).toLowerCase();
    const phone = cleanString(payload.phone, 40);
    if (name.length < 2) throw new Error("Укажите имя партнёра");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Укажите корректный email");
    if (phone.length < 7) throw new Error("Укажите номер телефона");
    const program = await getPublicProgramBySlug(slug);
    if (!program) return Response.json({ error: "Программа недоступна" }, { status: 404 });
    const db = getDb();
    const existingRows = await db.select().from(partners).where(and(eq(partners.programId, program.id), eq(partners.email, email))).limit(1);
    const partnerId = existingRows[0]?.id ?? crypto.randomUUID();
    const rawToken = createPartnerToken();
    const tokenHash = await hashPartnerToken(rawToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const nameParts = name.split(/\s+/);
    const statements = [];
    if (existingRows[0]) statements.push(db.update(partners).set({ name, phone, lastActiveAt: now }).where(eq(partners.id, partnerId)));
    else statements.push(
      db.insert(partners).values({ id: partnerId, companyId: program.companyId, programId: program.id, name, email, phone, status: "ACTIVE", joinedAt: now, lastActiveAt: now }),
      db.insert(partnerProfiles).values({ partnerId, firstName: nameParts[0] ?? "", lastName: nameParts.slice(1).join(" "), updatedAt: now }),
    );
    statements.push(db.insert(partnerAccessLinks).values({ id: crypto.randomUUID(), partnerId, tokenHash, expiresAt, createdAt: now }));
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>]);
    const origin = new URL(request.url).origin;
    const partnerUrl = `${origin}/partner/${rawToken}`;
    const missionsUrl = `${origin}/p/${program.slug}?access=${rawToken}`;
    let emailSent = false;
    const runtime = env as unknown as { RESEND_API_KEY?: string; MAGIC_FROM_EMAIL?: string };
    if (runtime.RESEND_API_KEY && runtime.MAGIC_FROM_EMAIL) {
      const companyRows = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, program.companyId)).limit(1);
      const companyName = companyRows[0]?.name ?? "компании";
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${runtime.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: runtime.MAGIC_FROM_EMAIL, to: [email], subject: `Доступ к партнёрской программе ${companyName}`, html: `<p>Здравствуйте, ${escapeHtml(name)}!</p><p><a href="${partnerUrl}">Открыть защищённый кабинет партнёра</a></p><p>Ссылка действует 90 дней.</p>` }) });
      emailSent = response.ok;
    }
    return Response.json({ token: rawToken, partnerUrl, missionsUrl, emailSent }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось открыть программу" }, { status: 400 });
  }
}
