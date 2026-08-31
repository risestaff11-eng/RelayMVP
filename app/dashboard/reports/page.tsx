import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { ensureReportTemplate, getCompanyReportOverview, getCompanyReports } from "../../../db/reports";
import { getProgramsForCompany } from "../../../db/programs";
import { ReportsWorkspace } from "./reports-workspace";
export const metadata: Metadata={title:"Отчёты агентов"}; export const dynamic="force-dynamic";
export default async function ReportsPage(){const user=await requireChatGPTUser("/dashboard/reports");const company=await getCompanyForUser(user.userId);if(!company)redirect("/onboarding");const[template,reports,overview,programs]=await Promise.all([ensureReportTemplate(company.id),getCompanyReports(company.id),getCompanyReportOverview(company.id),getProgramsForCompany(company.id)]);return <ReportsWorkspace companyName={company.name} template={template} initialReports={reports} overview={overview} programs={programs.map(({id,name})=>({id,name}))}/>}
