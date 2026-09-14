import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { companies, programs, missions, companyProfileVersions, companyKnowledgeItems, users } from "../db/schema";

// Resolved from the live inventory, not from a fuzzy company-name match.
// Never apply a platform rebrand to customer companies or their records.
const ownedCompanyIds = ["362c7c7d-490d-445a-9f98-9c353324e20b", "6bb4e206-ec6d-475e-b3f1-250fff3b2a57"];

export function replaceLegacyBrand(text: string): string {
  return text.replace(/https?:\/\/[^\s<>"']+|\brelay(?:\.kz)?\b/gi, (match) => /^https?:/i.test(match) ? match : "RiseStaff");
}

function changes<T extends object, K extends keyof T>(row: T, keys: readonly K[]) {
  const patch: Partial<T> = {};
  for (const key of keys) {
    const before = row[key];
    if (typeof before !== "string") continue;
    const after = replaceLegacyBrand(before);
    if (after !== before) patch[key] = after as T[K];
  }
  return patch;
}

export async function updateRiseStaffBrand() {
  const db = getDb();
  const owned = (await db.select().from(companies).where(inArray(companies.id, ownedCompanyIds)))
    .filter((row) => /^https:\/\/(www\.)?risestaff\.kz\/?$/i.test(row.website));
  const now = new Date().toISOString();
  const updates = [];
  for (const company of owned) {
    const companyChanges = changes(company, ["name", "primaryGoal"]);
    if (Object.keys(companyChanges).length) updates.push(db.update(companies).set({ ...companyChanges, updatedAt: now }).where(and(eq(companies.id, company.id), eq(companies.updatedAt, company.updatedAt))));
    const owner = (await db.select().from(users).where(eq(users.id, company.ownerUserId)).limit(1))[0];
    if (owner && /^(relay(?:\.kz)?)$/i.test(owner.companyName.trim())) updates.push(db.update(users).set({ companyName: "RiseStaff", updatedAt: now }).where(and(eq(users.id, owner.id), eq(users.companyName, owner.companyName))));

    const companyPrograms = await db.select().from(programs).where(eq(programs.companyId, company.id));
    for (const program of companyPrograms) {
      const patch = changes(program, ["name", "description", "goal", "payoutTerms", "legalTerms"]);
      if (Object.keys(patch).length) updates.push(db.update(programs).set({ ...patch, updatedAt: now }).where(and(eq(programs.id, program.id), eq(programs.updatedAt, program.updatedAt))));
    }
    if (companyPrograms.length) {
      const companyMissions = await db.select().from(missions).where(inArray(missions.programId, companyPrograms.map((row) => row.id)));
      for (const mission of companyMissions) {
        const patch = changes(mission, ["title", "description", "instructionsJson", "proofRequirementsJson", "rewardLabel", "verificationRules"]);
        if (Object.keys(patch).length) updates.push(db.update(missions).set({ ...patch, updatedAt: now }).where(and(eq(missions.id, mission.id), eq(missions.updatedAt, mission.updatedAt))));
      }
    }
    const materials = await db.select().from(companyKnowledgeItems).where(eq(companyKnowledgeItems.companyId, company.id));
    for (const item of materials) {
      const patch = changes(item, ["title", "summary", "content", "agentAction", "audience"]);
      if (Object.keys(patch).length) updates.push(db.update(companyKnowledgeItems).set({ ...patch, updatedAt: now }).where(and(eq(companyKnowledgeItems.id, item.id), eq(companyKnowledgeItems.updatedAt, item.updatedAt))));
    }
    // Confirmed profiles are immutable: retain the original and make a new
    // brand-only version. No AI generation, changed terms, or credit charge.
    const latest = (await db.select().from(companyProfileVersions).where(eq(companyProfileVersions.companyId, company.id)).orderBy(desc(companyProfileVersions.versionNumber)).limit(1))[0];
    if (latest) {
      const patch = changes(latest, ["businessDescription", "productsJson", "targetAudience", "advantagesJson", "buyingTriggersJson", "disqualifiersJson", "partnerPitch"]);
      if (Object.keys(patch).length) updates.push(db.insert(companyProfileVersions).values({ ...latest, ...patch, id: crypto.randomUUID(), versionNumber: latest.versionNumber + 1, createdAt: now, updatedAt: now }));
    }
  }
  if (updates.length) {
    // One D1 transaction; the operation is bounded to two known workspaces.
    if (updates.length > 80) throw new Error("Brand maintenance batch requires review");
    await db.batch(updates as [typeof updates[number], ...typeof updates[number][]]);
  }
  return { changedRecords: updates.length };
}
