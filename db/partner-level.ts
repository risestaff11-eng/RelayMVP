import { and, eq, inArray } from "drizzle-orm";
import { getDb } from ".";
import { partnerProfiles, submissions } from "./schema";

const QUALIFYING_STATUSES = ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"];

export async function syncPartnerLevel(partnerId: string) {
  const db = getDb();
  const [profileRows, acceptedRows] = await Promise.all([
    db.select().from(partnerProfiles).where(eq(partnerProfiles.partnerId, partnerId)).limit(1),
    db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.partnerId, partnerId), inArray(submissions.status, QUALIFYING_STATUSES))).limit(1),
  ]);
  const profile = profileRows[0];
  if (!profile) return 1;
  const eligible = Boolean(profile.emailVerifiedAt && profile.whatsappVerifiedAt && acceptedRows.length);
  const nextLevel = profile.level >= 2 || eligible ? 2 : 1;
  if (nextLevel !== profile.level) {
    await db.update(partnerProfiles).set({ level: nextLevel, updatedAt: new Date().toISOString() }).where(eq(partnerProfiles.partnerId, partnerId));
  }
  return nextLevel;
}
