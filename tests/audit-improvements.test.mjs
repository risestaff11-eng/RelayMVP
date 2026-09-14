import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { agentFixture } from "./helpers/agent-fixture.mjs";

test("public participation preserves existing identity without removing email access", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    await f.db.insert(f.schema.users).values({ id: "existing", email: "existing@example.test", displayName: "Original", phone: "+77011112233" });
    const response = await f.request("/api/public/partners/join", { programSlug: "program-a", missionId: a.missionId, email: "existing@example.test", name: "Replacement", phone: "+77055556677", acceptedTerms: true });
    assert.equal(response.status, 201, await response.clone().text());
    assert.ok((await response.json()).token);
    const user = f.sqlite.prepare("SELECT display_name, phone FROM users WHERE id='existing'").get();
    assert.equal(user.display_name, "Original"); assert.equal(user.phone, "+77011112233");
  } finally { f.close(); }
});

test("admin totals and export values keep currencies separate", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    for (const [currency, amount] of [["KZT", 35000], ["USD", 100]]) {
      await f.db.insert(f.schema.submissions).values({ id: currency, companyId: a.companyId, programId: a.programId, partnerId: a.partnerId, missionId: a.missionId, type: "LEAD" });
      await f.db.insert(f.schema.rewards).values({ id: currency, submissionId: currency, companyId: a.companyId, partnerId: a.partnerId, currency, amount, status: "PAID" });
    }
    await f.db.insert(f.schema.userRoles).values({ userId: `${a.companyId}-owner`, role: "COMPANY" }).onConflictDoNothing();
    const rows = await f.load(new URL("../db/admin.ts", import.meta.url)).listCompanyUsers();
    const row = rows.find((item) => item.companyId === a.companyId);
    assert.equal(row.paidRewardsAmount, 35000);
    const { currencyTotals } = f.load(new URL("../lib/currency-totals.ts", import.meta.url));
    assert.deepEqual(currencyTotals([row.rewardAmountsJson]), [{ currency: "KZT", paid: 35000, due: 0 }, { currency: "USD", paid: 100, due: 0 }]);
  } finally { f.close(); }
});

test("report paging searches all records and never recalculates every report in a list", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed(); const b = await f.seed({ companyId: "b", programId: "b", partnerId: "b" });
    for (let index = 0; index < 61; index++) await f.db.insert(f.schema.agentReports).values({ id: String(index).padStart(3, "0"), companyId: a.companyId, partnerId: a.partnerId, programId: a.programId, periodStart: "2026-09-01", periodEnd: "2026-09-30", status: index === 0 ? "NEEDS_CLARIFICATION" : "SUBMITTED" });
    await f.db.insert(f.schema.agentReports).values({ id: "other", companyId: b.companyId, partnerId: b.partnerId, periodStart: "2026-09-01", periodEnd: "2026-09-30", status: "SUBMITTED" });
    const read = f.load(new URL("../db/reports.ts", import.meta.url));
    const first = await read.getCompanyReportPage(a.companyId);
    const second = await read.getCompanyReportPage(a.companyId, { offset: 25 });
    const third = await read.getCompanyReportPage(a.companyId, { offset: 50 });
    assert.equal(first.reports.length, 25); assert.equal(first.hasMore, true);
    assert.equal(new Set([...first.reports, ...second.reports, ...third.reports].map((row) => row.id)).size, 61);
    assert.equal(third.hasMore, false); assert.deepEqual(first.reports[0].metrics, {});
    assert.equal((await read.getCompanyReportPage(a.companyId, { status: "NEEDS_CLARIFICATION" })).reports[0].id, "000");
    assert.equal((await read.getCompanyReports(a.companyId, { id: "other" })).length, 0);
  } finally { f.close(); }
});

test("monthly report participation counts a person once and excludes previous periods", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    await f.seed({ programId: "second", partnerId: "second" });
    const { localMonth } = f.load(new URL("../lib/financial-periods.ts", import.meta.url));
    const month = localMonth();
    const read = f.load(new URL("../db/reports.ts", import.meta.url));
    await f.db.insert(f.schema.agentReports).values({ id: "old", companyId: a.companyId, partnerId: a.partnerId, periodStart: "2025-01-01", periodEnd: "2025-01-31", status: "ACCEPTED" });
    assert.equal((await read.getCompanyReportOverview(a.companyId)).missingAgents, 1);
    await f.db.insert(f.schema.agentReports).values({ id: "new", companyId: a.companyId, partnerId: a.partnerId, periodStart: `${month}-01`, periodEnd: `${month}-01`, status: "SUBMITTED" });
    const overview = await read.getCompanyReportOverview(a.companyId);
    assert.equal(overview.submittedAgents, 1); assert.equal(overview.missingAgents, 0); assert.equal(overview.total, 1);
  } finally { f.close(); }
});

test("durable email retries recover and concurrent workers claim a job only once", async (context) => {
  context.mock.method(console, "error", () => {});
  const f = agentFixture();
  try {
    const a = await f.seed();
    const email = f.load(new URL("../lib/agent-email.ts", import.meta.url));
    const realSend = email.sendCompanyNewSubmissionNotification;
    email.sendCompanyNewSubmissionNotification = async () => { throw new Error("offline"); };
    const response = await f.request("/api/public/submissions", f.form(a));
    assert.equal(response.status, 201);
    const { submissionId } = await response.json();
    assert.equal(f.sqlite.prepare("SELECT status FROM lead_notification_jobs").get().status, "RETRY");
    email.sendCompanyNewSubmissionNotification = realSend;
    f.sqlite.exec("UPDATE lead_notification_jobs SET next_attempt_at = NULL");
    const notices = f.load(new URL("../lib/company-submission-notifications.ts", import.meta.url));
    await Promise.all([notices.drainLeadNotifications(), notices.drainLeadNotifications()]);
    assert.equal(f.deliveries.length, 1);
    await notices.notifyCompanyNewSubmission(a.companyId, submissionId);
    assert.equal(f.deliveries.length, 1);
    assert.equal(f.sqlite.prepare("SELECT status FROM lead_notification_jobs").get().status, "SENT");
  } finally { f.close(); }
});

test("new submission and email job commit together; old submissions are not backfilled", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    const source = await readFile(new URL("../drizzle/0036_flat_nightshade.sql", import.meta.url), "utf8");
    f.sqlite.exec(source.split("--> statement-breakpoint").at(-1));
    await f.db.insert(f.schema.submissions).values({ id: "new", companyId: a.companyId, programId: a.programId, partnerId: a.partnerId, missionId: a.missionId, type: "LEAD" });
    assert.equal(f.sqlite.prepare("SELECT status FROM lead_notification_jobs WHERE submission_id='new'").get().status, "PENDING");
    f.sqlite.exec("BEGIN; INSERT INTO submissions(id,company_id,program_id,partner_id,mission_id,type) SELECT 'rollback',company_id,program_id,partner_id,mission_id,type FROM submissions WHERE id='new'; ROLLBACK;");
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM lead_notification_jobs").get().n, 1);
  } finally { f.close(); }
});

test("stale leases recover, retries are bounded and another company cannot retry a job", async (context) => {
  context.mock.method(console, "error", () => {});
  const f = agentFixture();
  try {
    const a = await f.seed(); const b = await f.seed({ companyId: "other-company", programId: "other-program", partnerId: "other-partner" });
    f.load(new URL("../lib/agent-email.ts", import.meta.url)).sendCompanyNewSubmissionNotification = async () => { throw new Error("offline"); };
    const { submissionId } = await (await f.request("/api/public/submissions", f.form(a))).json();
    f.sqlite.exec("UPDATE lead_notification_jobs SET status='PROCESSING', attempts=5, lease_until='2000-01-01', lease_token='stale'");
    const notices = f.load(new URL("../lib/company-submission-notifications.ts", import.meta.url));
    await notices.drainLeadNotifications();
    const job = f.sqlite.prepare("SELECT status, attempts FROM lead_notification_jobs").get();
    assert.equal(job.status, "FAILED"); assert.equal(job.attempts, 6);
    await notices.drainLeadNotifications();
    assert.equal(f.sqlite.prepare("SELECT attempts FROM lead_notification_jobs").get().attempts, 6);
    f.setCompany(b.companyId);
    assert.equal((await f.request("/api/company/notifications", { submissionId })).status, 409);
    f.setCompany(a.companyId);
    assert.equal((await f.request("/api/company/notifications", { submissionId })).status, 200);
    assert.equal(f.sqlite.prepare("SELECT attempts FROM lead_notification_jobs").get().attempts, 1);
  } finally { f.close(); }
});
