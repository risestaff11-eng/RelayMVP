import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from ".";
import { agentReports, partnerMissionAcceptances, partners, programs, reportFiles, reportRevisions, reportTemplates, rewards, submissions } from "./schema";
import { DEFAULT_REPORT_METRICS, defaultReportFields, parseMetricKeys, parseReportFields } from "../lib/reporting";

function json<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }

export async function ensureReportTemplate(companyId: string) {
  const db = getDb();
  const existing = (await db.select().from(reportTemplates).where(and(eq(reportTemplates.companyId, companyId), eq(reportTemplates.status, "ACTIVE"))).orderBy(asc(reportTemplates.createdAt)).limit(1))[0];
  if (existing) return { ...existing, fields: parseReportFields(existing.fieldsJson), metrics: parseMetricKeys(existing.metricsJson) };
  const now = new Date().toISOString(); const id = crypto.randomUUID();
  await db.insert(reportTemplates).values({ id, companyId, name: "Регулярный отчёт", fieldsJson: JSON.stringify(defaultReportFields()), metricsJson: JSON.stringify(DEFAULT_REPORT_METRICS), status: "ACTIVE", createdAt: now, updatedAt: now });
  return { id, companyId, programId: null, name: "Регулярный отчёт", fieldsJson: JSON.stringify(defaultReportFields()), metricsJson: JSON.stringify(DEFAULT_REPORT_METRICS), status: "ACTIVE", createdAt: now, updatedAt: now, fields: defaultReportFields(), metrics: DEFAULT_REPORT_METRICS };
}

export async function calculatePartnerReportMetrics(partnerIds: string[], periodStart: string, periodEnd: string) {
  if (!partnerIds.length) return {};
  const db = getDb(); const end = `${periodEnd}T23:59:59.999Z`; const start = `${periodStart}T00:00:00.000Z`;
  const resultRows = await db.select().from(submissions).where(and(inArray(submissions.partnerId, partnerIds), gte(submissions.createdAt, start), lte(submissions.createdAt, end)));
  const rewardRows = await db.select().from(rewards).where(and(inArray(rewards.partnerId, partnerIds), gte(rewards.createdAt, start), lte(rewards.createdAt, end)));
  const completedRows = await db.select().from(partnerMissionAcceptances).where(and(inArray(partnerMissionAcceptances.partnerId, partnerIds), gte(partnerMissionAcceptances.completedAt, start), lte(partnerMissionAcceptances.completedAt, end)));
  const sum = (statuses: string[]) => rewardRows.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + item.amount, 0);
  return {
    completedTasks: completedRows.length,
    submissions: resultRows.length,
    accepted: resultRows.filter((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)).length,
    rejected: resultRows.filter((item) => item.status === "REJECTED").length,
    leads: resultRows.filter((item) => item.type === "LEAD").length,
    deals: resultRows.filter((item) => ["DEAL", "REWARDED"].includes(item.status)).length,
    accrued: sum(["APPROVED", "PAID"]), paid: sum(["PAID"]), pending: sum(["PENDING", "APPROVED"]),
  };
}

export async function getPartnerReports(partnerIds: string[]) {
  if (!partnerIds.length) return [];
  const db = getDb(); const rows = await db.select().from(agentReports).where(inArray(agentReports.partnerId, partnerIds)).orderBy(desc(agentReports.periodEnd), desc(agentReports.updatedAt));
  const ids = rows.map((item) => item.id); const files = ids.length ? await db.select().from(reportFiles).where(inArray(reportFiles.reportId, ids)).orderBy(asc(reportFiles.createdAt)) : [];
  return rows.map((row) => ({ ...row, templateSnapshot: parseReportFields(row.templateSnapshotJson), answers: json<Record<string, unknown>>(row.answersJson, {}), metrics: json<Record<string, number>>(row.metricsJson, {}), aiSummary: json<Record<string, unknown>>(row.aiSummaryJson, {}), files: files.filter((file) => file.reportId === row.id) }));
}

export async function getCompanyReports(companyId: string) {
  const db = getDb();
  const rows = await db.select({ report: agentReports, partnerName: partners.name, partnerEmail: partners.email, partnerPhone: partners.phone, programName: programs.name }).from(agentReports)
    .innerJoin(partners, eq(agentReports.partnerId, partners.id)).leftJoin(programs, eq(agentReports.programId, programs.id)).where(eq(agentReports.companyId, companyId)).orderBy(desc(agentReports.periodEnd), desc(agentReports.updatedAt));
  const ids = rows.map(({ report }) => report.id); const files = ids.length ? await db.select().from(reportFiles).where(inArray(reportFiles.reportId, ids)).orderBy(asc(reportFiles.createdAt)) : [];
  return rows.map(({ report, ...identity }) => ({ ...report, ...identity, templateSnapshot: parseReportFields(report.templateSnapshotJson), answers: json<Record<string, unknown>>(report.answersJson, {}), metrics: json<Record<string, number>>(report.metricsJson, {}), aiSummary: json<Record<string, unknown>>(report.aiSummaryJson, {}), files: files.filter((file) => file.reportId === report.id) }));
}

export async function getCompanyReportOverview(companyId: string) {
  const db = getDb(); const [reportRows, partnerRows] = await Promise.all([getCompanyReports(companyId), db.select({ id: partners.id }).from(partners).where(and(eq(partners.companyId, companyId), eq(partners.status, "ACTIVE")))]);
  const submitted = reportRows.filter((item) => item.status !== "DRAFT"); const reporters = new Set(submitted.map((item) => item.partnerId));
  const aggregate = submitted.reduce<Record<string, number>>((acc, item) => { for (const [key, value] of Object.entries(item.metrics)) acc[key] = (acc[key] || 0) + (Number(value) || 0); return acc; }, {});
  return { total: submitted.length, submittedAgents: reporters.size, missingAgents: Math.max(0, partnerRows.length - reporters.size), needsClarification: submitted.filter((item) => item.status === "NEEDS_CLARIFICATION").length, aggregate };
}

export async function getReportRevisions(reportId: string) { return getDb().select().from(reportRevisions).where(eq(reportRevisions.reportId, reportId)).orderBy(desc(reportRevisions.createdAt)); }

export async function getReportFileForPartner(reportId: string, fileId: string, partnerIds: string[]) {
  const db = getDb(); const row = (await db.select({ file: reportFiles, report: agentReports }).from(reportFiles).innerJoin(agentReports, eq(reportFiles.reportId, agentReports.id)).where(and(eq(reportFiles.id, fileId), eq(agentReports.id, reportId), inArray(agentReports.partnerId, partnerIds))).limit(1))[0]; return row?.file ?? null;
}

export async function getReportFileForCompany(companyId: string, reportId: string, fileId: string) {
  const db = getDb(); const row = (await db.select().from(reportFiles).where(and(eq(reportFiles.id, fileId), eq(reportFiles.reportId, reportId), eq(reportFiles.companyId, companyId))).limit(1))[0]; return row ?? null;
}
