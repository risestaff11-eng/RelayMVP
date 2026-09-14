import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from ".";
import { agentReports, partnerMissionAcceptances, partners, programs, reportFiles, reportRevisions, reportTemplates, rewards, submissions, submissionStatusEvents } from "./schema";
import { DEFAULT_REPORT_METRICS, defaultReportFields, parseMetricKeys, parseReportFields } from "../lib/reporting";
import { saleCompletedAt, withinPeriod, localMonth } from "../lib/financial-periods";

function json<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }

async function chunks<T>(ids: string[], read: (chunk: string[]) => Promise<T[]>) {
  const result: T[] = [];
  const unique = [...new Set(ids)];
  for (let index = 0; index < unique.length; index += 80) result.push(...await read(unique.slice(index, index + 80)));
  return result;
}

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
  const allResults = await chunks(partnerIds, (ids) => db.select().from(submissions).where(inArray(submissions.partnerId, ids)));
  const resultRows = allResults.filter((row) => withinPeriod(row.createdAt, periodStart, periodEnd));
  const rewardRows = await chunks(partnerIds, (ids) => db.select().from(rewards).where(inArray(rewards.partnerId, ids)));
  const events = await chunks(allResults.map((row) => row.id), (ids) => db.select().from(submissionStatusEvents).where(inArray(submissionStatusEvents.submissionId, ids)));
  const completedRows = await chunks(partnerIds, (ids) => db.select().from(partnerMissionAcceptances).where(and(inArray(partnerMissionAcceptances.partnerId, ids), gte(partnerMissionAcceptances.completedAt, start), lte(partnerMissionAcceptances.completedAt, end))));
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
  const db = getDb(); const rows = await chunks(partnerIds, (ids) => db.select().from(agentReports).where(inArray(agentReports.partnerId, ids)).orderBy(desc(agentReports.periodEnd), desc(agentReports.updatedAt)));
  rows.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.updatedAt.localeCompare(a.updatedAt));
  const ids = rows.map((item) => item.id); const files = await chunks(ids, (chunk) => db.select().from(reportFiles).where(inArray(reportFiles.reportId, chunk)).orderBy(asc(reportFiles.createdAt)));
  return Promise.all(rows.map(async (row) => ({ ...row, templateSnapshot: parseReportFields(row.templateSnapshotJson), answers: json<Record<string, unknown>>(row.answersJson, {}), metrics: await currentReportMetrics(row), aiSummary: json<Record<string, unknown>>(row.aiSummaryJson, {}), files: files.filter((file) => file.reportId === row.id) })));
}

async function currentReportMetrics(report: typeof agentReports.$inferSelect) {
  const all = await getDb().select().from(partners).where(eq(partners.companyId, report.companyId));
  const owner = all.find((row) => row.id === report.partnerId);
  const ids = all.filter((row) => owner && (owner.userId && row.userId ? row.userId === owner.userId : row.email.toLowerCase() === owner.email.toLowerCase()) && (!report.programId || row.programId === report.programId)).map((row) => row.id);
  return calculatePartnerReportMetrics(ids.length ? ids : [report.partnerId], report.periodStart, report.periodEnd);
}

export type CompanyReportQuery = { query?: string; program?: string; status?: string; audio?: boolean; files?: boolean; offset?: number; limit?: number; id?: string; details?: boolean; publishedOnly?: boolean };

export async function getCompanyReports(companyId: string, options: CompanyReportQuery = {}) {
  const db = getDb();
  const conditions = [eq(agentReports.companyId, companyId)];
  if (options.publishedOnly) conditions.push(sql`${agentReports.status} <> 'DRAFT'`);
  if (options.id) conditions.push(eq(agentReports.id, options.id));
  if (options.query) conditions.push(sql`instr(lower(${partners.name} || ' ' || ${partners.email} || ' ' || ${partners.phone}), lower(${options.query})) > 0`);
  if (options.program) conditions.push(eq(agentReports.programId, options.program));
  if (options.status) conditions.push(eq(agentReports.status, options.status));
  if (options.audio) conditions.push(sql`exists (select 1 from report_files f where f.report_id = ${agentReports.id} and f.kind = 'AUDIO')`);
  if (options.files) conditions.push(sql`exists (select 1 from report_files f where f.report_id = ${agentReports.id} and f.kind = 'ATTACHMENT')`);
  const rows = await db.select({ report: agentReports, partnerName: partners.name, partnerEmail: partners.email, partnerPhone: partners.phone, partnerUserId: partners.userId, programName: programs.name }).from(agentReports)
    .innerJoin(partners, eq(agentReports.partnerId, partners.id)).leftJoin(programs, eq(agentReports.programId, programs.id)).where(and(...conditions)).orderBy(desc(agentReports.periodEnd), desc(agentReports.createdAt), desc(agentReports.id)).limit(options.limit ?? 2147483647).offset(options.offset ?? 0);
  const ids = rows.map(({ report }) => report.id); const files = await chunks(ids, (chunk) => db.select().from(reportFiles).where(inArray(reportFiles.reportId, chunk)).orderBy(asc(reportFiles.createdAt)));
  return Promise.all(rows.map(async ({ report, ...identity }) => {
    const currentMetrics = options.details === false ? {} : await currentReportMetrics(report);
    return { ...report, ...identity, templateSnapshot: parseReportFields(report.templateSnapshotJson), answers: json<Record<string, unknown>>(report.answersJson, {}), metrics: currentMetrics, aiSummary: json<Record<string, unknown>>(report.aiSummaryJson, {}), files: files.filter((file) => file.reportId === report.id) };
  }));
}

export async function getCompanyReportPage(companyId: string, options: CompanyReportQuery = {}) {
  const reports = await getCompanyReports(companyId, { ...options, limit: 26, details: false, publishedOnly: true });
  return { reports: reports.slice(0, 25), hasMore: reports.length > 25 };
}

export async function getCompanyReportOverview(companyId: string) {
  const db = getDb();
  const month = localMonth();
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
  const [allPartners, submitted] = await Promise.all([
    db.select().from(partners).where(eq(partners.companyId, companyId)),
    db.select({ partnerId: agentReports.partnerId, status: agentReports.status }).from(agentReports).where(and(eq(agentReports.companyId, companyId), sql`${agentReports.status} <> 'DRAFT'`, gte(agentReports.periodStart, `${month}-01`), lte(agentReports.periodEnd, end))),
  ]);
  const identity = (partnerId: string) => { const partner = allPartners.find((row) => row.id === partnerId); return partner?.userId || partner?.email.trim().toLowerCase() || partnerId; };
  const expected = new Set(allPartners.filter((row) => row.status === "ACTIVE").map((row) => identity(row.id)));
  const reporters = new Set(submitted.map((row) => identity(row.partnerId)));
  const aggregate = await calculatePartnerReportMetrics(allPartners.map((row) => row.id), `${month}-01`, end);
  return { total: submitted.length, submittedAgents: reporters.size, missingAgents: [...expected].filter((id) => !reporters.has(id)).length, needsClarification: submitted.filter((item) => item.status === "NEEDS_CLARIFICATION").length, aggregate };
}

export async function getReportRevisions(reportId: string) { return getDb().select().from(reportRevisions).where(eq(reportRevisions.reportId, reportId)).orderBy(desc(reportRevisions.createdAt)); }

export async function getReportFileForPartner(reportId: string, fileId: string, partnerIds: string[]) {
  const db = getDb(); const row = (await db.select({ file: reportFiles, report: agentReports }).from(reportFiles).innerJoin(agentReports, eq(reportFiles.reportId, agentReports.id)).where(and(eq(reportFiles.id, fileId), eq(agentReports.id, reportId), inArray(agentReports.partnerId, partnerIds))).limit(1))[0]; return row?.file ?? null;
}

export async function getReportFileForCompany(companyId: string, reportId: string, fileId: string) {
  const db = getDb(); const row = (await db.select().from(reportFiles).where(and(eq(reportFiles.id, fileId), eq(reportFiles.reportId, reportId), eq(reportFiles.companyId, companyId))).limit(1))[0]; return row ?? null;
}
