import { and, eq } from "drizzle-orm";
import { getDb } from ".";
import { hashPartnerToken } from "../lib/partner-token";
import { companies, missions, partnerReferralLinks, partners, programs } from "./schema";

export async function getPublicReferral(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await hashPartnerToken(token);
  const rows = await getDb().select({ link: partnerReferralLinks, partner: partners, mission: missions, program: programs, company: companies })
    .from(partnerReferralLinks)
    .innerJoin(partners, eq(partnerReferralLinks.partnerId, partners.id))
    .innerJoin(missions, eq(partnerReferralLinks.missionId, missions.id))
    .innerJoin(programs, eq(missions.programId, programs.id))
    .innerJoin(companies, eq(programs.companyId, companies.id))
    .where(and(eq(partnerReferralLinks.tokenHash, tokenHash), eq(partnerReferralLinks.status, "ACTIVE")))
    .limit(1);
  const row = rows[0];
  if (!row || new Date(row.link.expiresAt).getTime() < Date.now()) return null;
  if (row.partner.status !== "ACTIVE" || row.mission.status !== "ACTIVE" || row.program.status !== "ACTIVE") return null;
  if (row.partner.programId !== row.program.id || row.partner.companyId !== row.company.id) return null;
  return row;
}
