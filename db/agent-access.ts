import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from ".";
import { companies, partnerAccessLinks, partners, programs, rewards } from "./schema";
import { normalizeAgentEmail, normalizeAgentPhone } from "../lib/agent-auth";
import { createPartnerToken, hashPartnerToken } from "../lib/partner-token";

export async function findAgentPartners(emailValue: string, phoneValue: string) {
  const email = normalizeAgentEmail(emailValue);
  const phone = normalizeAgentPhone(phoneValue);
  if (!/^\S+@\S+\.\S+$/.test(email) || phone.length < 10) return [];
  const rows = await getDb().select().from(partners)
    .where(and(sql`lower(${partners.email}) = ${email}`, ne(partners.status, "BLOCKED")));
  return rows.filter((row) => normalizeAgentPhone(row.phone) === phone);
}

export async function getAgentWorkspace(email: string, phone: string) {
  const matched = await findAgentPartners(email, phone);
  if (!matched.length) return null;
  const ids = matched.map((row) => row.id);
  const rows = await getDb().select({
    partnerId: partners.id,
    partnerName: partners.name,
    companyId: companies.id,
    companyName: companies.name,
    programId: programs.id,
    programName: programs.name,
    programStatus: programs.status,
    programExpiresAt: programs.expiresAt,
    currency: programs.currency,
    missionCount: sql<number>`coalesce((select count(*) from missions m where m.program_id = ${programs.id} and m.status = 'ACTIVE'), 0)`,
    submissionCount: sql<number>`coalesce((select count(*) from submissions s where s.partner_id = ${partners.id}), 0)`,
  }).from(partners)
    .innerJoin(companies, eq(partners.companyId, companies.id))
    .innerJoin(programs, eq(partners.programId, programs.id))
    .where(inArray(partners.id, ids))
    .orderBy(asc(companies.name), asc(programs.name));
  const pendingRows = await getDb().select().from(rewards).where(and(inArray(rewards.partnerId, ids), inArray(rewards.status, ["PENDING", "APPROVED"])));
  const companiesMap = new Map<string, { id: string; name: string; agentName: string; programs: Array<{ id: string; name: string; status: string; currency: string; missionCount: number; submissionCount: number; historyOnly: boolean; pendingRewards: Array<{ amount: number; currency: string }> }> }>();
  for (const row of rows) {
    const company = companiesMap.get(row.companyId) ?? { id: row.companyId, name: row.companyName, agentName: row.partnerName, programs: [] };
    const historyOnly = row.programStatus !== "ACTIVE" || !!row.programExpiresAt && Date.parse(row.programExpiresAt) <= Date.now();
    company.programs.push({ id: row.programId, name: row.programName, status: row.programStatus, currency: row.currency, missionCount: historyOnly ? 0 : Number(row.missionCount), submissionCount: Number(row.submissionCount), historyOnly, pendingRewards: pendingRows.filter((reward) => reward.partnerId === row.partnerId).map(({ amount, currency }) => ({ amount, currency })) });
    companiesMap.set(row.companyId, company);
  }
  return { email: normalizeAgentEmail(email), phone: normalizeAgentPhone(phone), name: matched[0].name, companies: [...companiesMap.values()] };
}

export async function createCompanyAccessForAgent(email: string, phone: string, companyId: string) {
  const matched = await findAgentPartners(email, phone);
  const availablePrograms = await getDb().select({ id: programs.id }).from(programs)
    .where(eq(programs.companyId, companyId));
  const availableProgramIds = new Set(availablePrograms.map((item) => item.id));
  const partner = matched.find((row) => row.companyId === companyId && availableProgramIds.has(row.programId));
  if (!partner) return null;
  const rawToken = createPartnerToken();
  const now = new Date().toISOString();
  await getDb().insert(partnerAccessLinks).values({
    id: crypto.randomUUID(),
    partnerId: partner.id,
    tokenHash: await hashPartnerToken(rawToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
  });
  return rawToken;
}
