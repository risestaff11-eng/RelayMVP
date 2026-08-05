import { desc, eq } from "drizzle-orm";
import { getDb } from ".";
import { companyProfileVersions } from "./schema";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type CompanyProfile = {
  id: string;
  versionNumber: number;
  sourceWebsite: string;
  status: string;
  businessDescription: string;
  products: string[];
  targetAudience: string;
  advantages: string[];
  buyingTriggers: string[];
  disqualifiers: string[];
  geographies: string[];
  partnerPitch: string;
  missingFields: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  confirmedAt: string | null;
  createdAt: string;
};

export function serializeProfile(row: typeof companyProfileVersions.$inferSelect): CompanyProfile {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    sourceWebsite: row.sourceWebsite,
    status: row.status,
    businessDescription: row.businessDescription,
    products: parseList(row.productsJson),
    targetAudience: row.targetAudience,
    advantages: parseList(row.advantagesJson),
    buyingTriggers: parseList(row.buyingTriggersJson),
    disqualifiers: parseList(row.disqualifiersJson),
    geographies: parseList(row.geographiesJson),
    partnerPitch: row.partnerPitch,
    missingFields: parseList(row.missingFieldsJson),
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
  };
}

export async function getLatestCompanyProfile(companyId: string) {
  const rows = await getDb()
    .select()
    .from(companyProfileVersions)
    .where(eq(companyProfileVersions.companyId, companyId))
    .orderBy(desc(companyProfileVersions.versionNumber))
    .limit(1);
  return rows[0] ? serializeProfile(rows[0]) : null;
}
