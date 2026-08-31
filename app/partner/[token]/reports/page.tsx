import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { ensureReportTemplate, getPartnerReports } from "../../../../db/reports";
import { ReportCenter } from "./report-center";
export const metadata: Metadata = { title: "Отчёты агента" }; export const dynamic = "force-dynamic";
export default async function ReportsPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; const portal = await getPartnerPortal(token); if (!portal) notFound(); const [template, reports] = await Promise.all([ensureReportTemplate(portal.company.id), getPartnerReports(portal.partners.map((item) => item.id))]); return <ReportCenter token={token} companyName={portal.company.name} programs={portal.programs.map(({ id, name }) => ({ id, name }))} template={template} initialReports={reports} />; }
