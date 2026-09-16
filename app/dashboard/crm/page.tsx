import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getSubmissionsForCompany } from "../../../db/programs";
import { CrmWorkspace, type CrmLead } from "./crm-workspace";
import { crmBoard } from "../../../db/crm-board";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

type Query = { submission?: string; quick?: string };

export default async function CrmPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const quick = query.quick === "ACTION" ? "ACTION" : "ALL";
  const returnTo = query.submission ? `/dashboard/crm?submission=${encodeURIComponent(query.submission)}` : `/dashboard/crm?quick=${quick}`;
  const user = await requireChatGPTUser(returnTo);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");

  const board = await crmBoard(company, { quick });
  const selected = query.submission ? (await getSubmissionsForCompany(company.id, { ids: [query.submission] }))[0] : null;
  const submissions = selected && !board.items.some((item) => item.id === selected.id) ? [...board.items, selected] : board.items;

  return <div className="dashboard-content crm-page crm-page-immersive">
    <CrmWorkspace companyName={company.name} initialItems={submissions as CrmLead[]} initialBoard={board} initialQuick={quick} initialSelectedId={query.submission || ""} initialSettings={{ monthlyGoal: company.crmMonthlyGoal, averageCheck: company.crmAverageCheck, conversionRate: company.crmConversionRate, currency: company.crmGoalCurrency }} />
  </div>;
}
