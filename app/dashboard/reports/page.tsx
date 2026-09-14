import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { ensureReportTemplate, getCompanyReportOverview, getCompanyReportPage } from "../../../db/reports";
import { getProgramsForCompany } from "../../../db/programs";
import { ReportsWorkspace } from "./reports-workspace";
import { subscriptionAllows } from "@/lib/subscription-plans";
import { PlanRequired } from "../_components/plan-required";
export const metadata: Metadata={title:"Отчёты агентов"}; export const dynamic="force-dynamic";
export default async function ReportsPage() {
  const user = await requireChatGPTUser("/dashboard/reports");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  if (!subscriptionAllows(company, "REPORTS")) return <PlanRequired />;
  const [template, page, overview, programs] = await Promise.all([
    ensureReportTemplate(company.id), getCompanyReportPage(company.id), getCompanyReportOverview(company.id), getProgramsForCompany(company.id),
  ]);
  return <ReportsWorkspace companyName={company.name} template={template} initialReports={page.reports} initialHasMore={page.hasMore} overview={overview} programs={programs.map(({ id, name }) => ({ id, name }))} />;
}
