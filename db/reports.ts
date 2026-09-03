import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from ".";
import { agentReports, partnerMissionAcceptances, partners, programs, reportFiles, reportRevisions, reportTemplates, rewards, submissions, submissionStatusEvents } from "./schema";
import { DEFAULT_REPORT_METRICS, defaultReportFields, parseMetricKeys, parseReportFields } from "../lib/reporting";
import { saleCompletedAt, withinPeriod, localMonth } from "../lib/financial-periods";

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
  const db = getDb();
  const start = new Date(`${periodStart}T00:00:00.000+05:00`).toISOString();
  const end = new Date(`${periodEnd}T23:59:59.999+05:00`).toISOString();
  const allResults = await db.select().from(submissions).where(inArray(submissions.partnerId, partnerIds));
  const resultRows = allResults.filter((row) => withinPeriod(row.createdAt, periodStart, periodEnd));
  const rewardRows = await db.select().from(rewards).where(inArray(rewards.partnerId, partnerIds));
  const events = allResults.length ? await db.select().from(submissionStatusEvents).where(inArray(submissionStatusEvents.submissionId, allResults.map((row) => row.id))) : [];
  const completedRows = await db.select().from(partnerMissionAcceptances).where(and(inArray(partnerMissionAcceptances.partnerId, partnerIds), gte(partnerMissionAcceptances.completedAt, start), lte(partnerMissionAcceptances.completedAt, end)));
  const period = (date: string | null) => withinPeriod(date, periodStart, periodEnd);
  const accrued = rewardRows.filter((item) => ["APPROVED", "PAID"].includes(item.status) && period(item.approvedAt));
  const paid = rewardRows.filter((item) => item.status === "PAID" && period(item.paidAt));
  const confirmed = rewardRows.filter((item) => item.status === "PAID" && period(item.partnerConfirmedAt));
  // Outstanding approved rewards at the end of the selected period, not drafts.
  const pending = rewardRows.filter((item) => ["APPROVED", "PAID"].includes(item.status) && item.approvedAt && withinPeriod(item.approvedAt, "1970-01-01", periodEnd) && (!item.paidAt || !withinPeriod(item.paidAt, "1970-01-01", periodEnd)));
  const monetary: Record<string, number> = {};
  for (const [key, rows] of Object.entries({ accrued, paid, confirmed, pending })) {
    const currencies = new Set(rows.map((item) => item.currency));
    for (const row of rows) monetary[`${key}:${row.currency}`] = (monetary[`${key}:${row.currency}`] || 0) + row.amount;
    // Keep legacy numeric keys for integrations, but never add unlike currencies.
    monetary[key] = currencies.size <= 1 ? rows.reduce((sum, row) => sum + row.amount, 0) : 0;
  }
  return {
    completedTasks: completedRows.length,
    submissions: resultRows.length,
    accepted: resultRows.filter((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)).length,
    rejected: resultRows.filter((item) => item.status === "REJECTED").length,
    leads: resultRows.filter((item) => item.type === "LEAD").length,
    deals: allResults.filter((item) => item.salesStatus === "WON" && period(saleCompletedAt(events.filter((event) => event.submissionId === item.id)))).length,
    ...monetary,
    paidRewardsCount: paid.length,
    confirmedRewardsCount: confirmed.length,
    pendingRewardsCount: pending.length,
  };
}

export async function getPartnerReports(partnerIds: string[]) {
  if (!partnerIds.length) return [];
  const db = getDb(); const rows = await db.select().from(agentReports).where(inArray(agentReports.partnerId, partnerIds)).orderBy(desc(agentReports.periodEnd), desc(agentReports.updatedAt));
  const ids = rows.map((item) => item.id); const files = ids.length ? await db.select().from(reportFiles).where(inArray(reportFiles.reportId, ids)).orderBy(asc(reportFiles.createdAt)) : [];
  return Promise.all(rows.map(async (row) => ({ ...row, templateSnapshot: parseReportFields(row.templateSnapshotJson), answers: json<Record<string, unknown>>(row.answersJson, {}), metrics: await currentReportMetrics(row), aiSummary: json<Record<string, unknown>>(row.aiSummaryJson, {}), files: files.filter((file) => file.reportId === row.id) })));
}

async function currentReportMetrics(report: typeof agentReports.$inferSelect) {
  const all = await getDb().select().from(partners).where(eq(partners.companyId, report.companyId));
  const owner = all.find((row) => row.id === report.partnerId);
  const ids = all.filter((row) => owner && (owner.userId && row.userId ? row.userId === owner.userId : row.email.toLowerCase() === owner.email.toLowerCase()) && (!report.programId || row.programId === report.programId)).map((row) => row.id);
  return calculatePartnerReportMetrics(ids.length ? ids : [report.partnerId], report.periodStart, report.periodEnd);
}

export async function getCompanyReports(companyId: string) {
  const db = getDb();
  const rows = await db.select({ report: agentReports, partnerName: partners.name, partnerEmail: partners.email, partnerPhone: partners.phone, partnerUserId: partners.userId, programName: programs.name }).from(agentReports)
    .innerJoin(partners, eq(agentReports.partnerId, partners.id)).leftJoin(programs, eq(agentReports.programId, programs.id)).where(eq(agentReports.companyId, companyId)).orderBy(desc(agentReports.periodEnd), desc(agentReports.updatedAt));
  const ids = rows.map(({ report }) => report.id); const files = ids.length ? await db.select().from(reportFiles).where(inArray(reportFiles.reportId, ids)).orderBy(asc(reportFiles.createdAt)) : [];
  return Promise.all(rows.map(async ({ report, ...identity }) => {
    const currentMetrics = await currentReportMetrics(report);
    return { ...report, ...identity, templateSnapshot: parseReportFields(report.templateSnapshotJson), answers: json<Record<string, unknown>>(report.answersJson, {}), metrics: currentMetrics, aiSummary: json<Record<string, unknown>>(report.aiSummaryJson, {}), files: files.filter((file) => file.reportId === report.id) };
  }));
}

export async function getCompanyReportOverview(companyId: string) {
  const db = getDb(); const [reportRows, partnerRows] = await Promise.all([getCompanyReports(companyId), db.select({ id: partners.id }).from(partners).where(and(eq(partners.companyId, companyId), eq(partners.status, "ACTIVE")))]);
  const submitted = reportRows.filter((item) => item.status !== "DRAFT"); const reporters = new Set(submitted.map((item) => item.partnerId));
  // Reports can overlap. Compute unique underlying records for this month once.
  const allPartners = await db.select({ id: partners.id }).from(partners).where(eq(partners.companyId, companyId));
  const month = localMonth();
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
  const aggregate = await calculatePartnerReportMetrics(allPartners.map((row) => row.id), `${month}-01`, end);
  return { total: submitted.length, submittedAgents: reporters.size, missingAgents: Math.max(0, partnerRows.length - reporters.size), needsClarification: submitted.filter((item) => item.status === "NEEDS_CLARIFICATION").length, aggregate };
}

export async function getReportRevisions(reportId: string) { return getDb().select().from(reportRevisions).where(eq(reportRevisions.reportId, reportId)).orderBy(desc(reportRevisions.createdAt)); }

export async function getReportFileForPartner(reportId: string, fileId: string, partnerIds: string[]) {
  const db = getDb(); const row = (await db.select({ file: reportFiles, report: agentReports }).from(reportFiles).innerJoin(agentReports, eq(reportFiles.reportId, agentReports.id)).where(and(eq(reportFiles.id, fileId), eq(agentReports.id, reportId), inArray(agentReports.partnerId, partnerIds))).limit(1))[0]; return row?.file ?? null;
}

export async function getReportFileForCompany(companyId: string, reportId: string, fileId: string) {
  const db = getDb(); const row = (await db.select().from(reportFiles).where(and(eq(reportFiles.id, fileId), eq(reportFiles.reportId, reportId), eq(reportFiles.companyId, companyId))).limit(1))[0]; return row ?? null;
}
