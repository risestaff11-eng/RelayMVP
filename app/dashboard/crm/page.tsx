import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getSubmissionsForCompany } from "../../../db/programs";
import { CrmWorkspace, type CrmLead } from "./crm-workspace";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

type Query = { submission?: string };

export default async function CrmPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const returnTo = query.submission ? `/dashboard/crm?submission=${encodeURIComponent(query.submission)}` : "/dashboard/crm";
  const user = await requireChatGPTUser(returnTo);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  const submissions = await getSubmissionsForCompany(company.id);

  return <div className="dashboard-content crm-page crm-page-immersive">
    <CrmWorkspace companyName={company.name} initialItems={submissions as CrmLead[]} initialSelectedId={query.submission || ""} initialSettings={{ monthlyGoal: company.crmMonthlyGoal, averageCheck: company.crmAverageCheck, conversionRate: company.crmConversionRate, currency: company.crmGoalCurrency }} />
  </div>;
}
