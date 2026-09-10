import { getChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { getCompanyKnowledge } from "../../../../db/knowledge";
import { getLatestCompanyProfile } from "../../../../db/profile";
import { getAgentsForCompany, getProgramsForCompany, getRewardsForCompany, getSubmissionsForCompany } from "../../../../db/programs";
import { getCompanyReports } from "../../../../db/reports";
import { companyPermissionDenied, hasCompanyPermission } from "../../../../lib/company-permissions";
import { getDb } from "../../../../db";
import { rewardAdjustments } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (!hasCompanyPermission(company.role, "DATA_EXPORT")) return companyPermissionDenied();
  const [programs, agents, submissions, rewardRows, adjustments, reports, knowledge, profile] = await Promise.all([
    getProgramsForCompany(company.id),
    getAgentsForCompany(company.id),
    getSubmissionsForCompany(company.id),
    getRewardsForCompany(company.id),
    getDb().select().from(rewardAdjustments).where(eq(rewardAdjustments.companyId, company.id)),
    getCompanyReports(company.id),
    getCompanyKnowledge(company.id),
    getLatestCompanyProfile(company.id),
  ]);
  const exportData = {
    format: "RISESTAFF_COMPANY_EXPORT_V1",
    exportedAt: new Date().toISOString(),
    company: { id: company.id, name: company.name, website: company.website, industry: company.industry, planCode: company.planCode, createdAt: company.createdAt },
    profile,
    programs,
    agents,
    submissions,
    rewards: rewardRows.map(({ reward, agent, submission, mission, program }) => ({ reward, agent: { id: agent.id, name: agent.name, email: agent.email, phone: agent.phone }, submissionId: submission.id, mission: { id: mission.id, title: mission.title }, program: { id: program.id, name: program.name } })),
    rewardAdjustments: adjustments,
    reports,
    knowledge,
  };
  const safeName = company.name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "company";
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="risestaff-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
