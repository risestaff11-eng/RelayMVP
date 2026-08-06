import { eq } from "drizzle-orm";
import { getDb } from ".";
import { companies, companyMembers } from "./schema";

export async function getCompanyForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      industry: companies.industry,
      teamSize: companies.teamSize,
      primaryGoal: companies.primaryGoal,
      onboardingStatus: companies.onboardingStatus,
      planCode: companies.planCode,
      aiTokenBalance: companies.aiTokenBalance,
      aiTokensUsed: companies.aiTokensUsed,
      role: companyMembers.role,
      createdAt: companies.createdAt,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(eq(companyMembers.userId, userId))
    .limit(1);

  const company = rows[0];
  if (!company) return null;
  if (company.aiTokenBalance > 5000) {
    const normalizedBalance = Math.max(0, 5000 - company.aiTokensUsed);
    await db.update(companies).set({ aiTokenBalance: normalizedBalance, updatedAt: new Date().toISOString() }).where(eq(companies.id, company.id));
    return { ...company, aiTokenBalance: normalizedBalance };
  }
  return company;
}
