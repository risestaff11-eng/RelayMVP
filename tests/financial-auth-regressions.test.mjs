import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { authFixture } from "./helpers/auth-fixture.mjs";

async function lead(f) {
  const a = await f.seed();
  await f.db.insert(f.schema.submissions).values({ id: "lead", companyId: a.companyId, programId: a.programId, missionId: a.missionId, partnerId: a.partnerId, type: "LEAD", contactName: "Synthetic Client" });
  f.setCompany(a.companyId);
  return { ...a, patch: (body) => f.request("/api/submissions/lead", body, { method: "PATCH", route: "/api/submissions/[id]", params: { id: "lead" } }) };
}
const reward = (f) => f.sqlite.prepare("SELECT * FROM rewards WHERE submission_id = 'lead'").get();
const transfer = (f, id, paid = true) => f.request(`/api/rewards/${id}`, { paid }, { method: "PATCH", route: "/api/rewards/[id]", params: { id } });

test("stage-only changes keep negotiated amount, zero is explicit, and currency is not overwritten", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    assert.equal((await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS", amount: 35000 })).status, 200);
    assert.equal((await a.patch({ salesStatus: "AGREEMENT" })).status, 200);
    assert.equal(reward(f).amount, 35000);
    f.sqlite.prepare("UPDATE programs SET currency = 'USD'").run();
    await a.patch({ comment: "Changed only note" });
    assert.equal(reward(f).currency, "KZT");
    await a.patch({ amount: 0 });
    assert.equal(reward(f).amount, 0);
    assert.equal((await a.patch({ amount: -1 })).status, 400);
    assert.equal((await a.patch({ salesStatus: "WON", dealAmount: 0 })).status, 400);
  } finally { f.close(); }
});

test("percentage rewards recalculate only with sale amount; non-commercial tasks still earn fixed rewards", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    f.sqlite.prepare("UPDATE missions SET reward_mode='PERCENT', reward_value=10").run();
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", dealAmount: 100000 });
    assert.equal(reward(f).amount, 10000);
    await a.patch({ dealAmount: 200000 });
    assert.equal(reward(f).amount, 20000);
    await a.patch({ comment: "Only a note" });
    assert.equal(reward(f).amount, 20000);
  } finally { f.close(); }
  for (const type of ["IMAGE", "ENGAGEMENT"]) {
    const f = agentFixture(); try {
      const a = await lead(f);
      f.sqlite.prepare("UPDATE submissions SET type=?").run(type);
      assert.equal((await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON" })).status, 200);
      assert.equal(reward(f).status, "APPROVED");
    } finally { f.close(); }
  }
});

test("paid lead comments preserve transfer, receipt, amount and sale date; edits cannot reverse settlement", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", amount: 35000, dealAmount: 200000 });
    assert.equal((await transfer(f, reward(f).id)).status, 200);
    assert.equal((await f.request("/api/partner/actions", { token: a.token, action: "CONFIRM_REWARD", rewardId: reward(f).id, confirmed: true })).status, 200);
    const before = reward(f);
    assert.equal((await a.patch({ comment: "A harmless comment" })).status, 200);
    const after = reward(f);
    for (const field of ["status", "amount", "currency", "paid_at", "partner_confirmed_at", "approved_at"]) assert.equal(after[field], before[field], field);
    assert.equal((await transfer(f, before.id)).status, 200);
    assert.equal(reward(f).paid_at, before.paid_at);
    assert.equal((await transfer(f, before.id, false)).status, 409);
    for (const patch of [{ amount: 25000 }, { salesStatus: "LOST", comment: "Refusal reason" }, { dealAmount: 100000 }]) assert.equal((await a.patch(patch)).status, 409);
    assert.equal((await f.request("/api/partner/actions", { token: a.token, action: "CONFIRM_REWARD", rewardId: before.id, confirmed: false })).status, 400);
    const portal = await f.load(new URL("../db/partner.ts", import.meta.url)).getPartnerPortal(a.token);
    assert.equal(portal.rewards[0].amount, 35000);
    assert.equal(portal.rewards[0].partnerConfirmedAt, before.partner_confirmed_at);
  } finally { f.close(); }
});

test("a transfer needs an approved reward; unconfirmed reversal is explicit and recorded", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS", amount: 35000 });
    assert.equal((await transfer(f, reward(f).id)).status, 409);
    await a.patch({ salesStatus: "WON", dealAmount: 100000 });
    await transfer(f, reward(f).id);
    assert.equal((await transfer(f, reward(f).id, false)).status, 200);
    assert.equal(reward(f).status, "APPROVED");
    assert.equal(reward(f).paid_at, null);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM submission_status_events WHERE comment LIKE '%отменила%'").get().n, 1);
  } finally { f.close(); }
});

test("simultaneous transfer and lead edit cannot reset a payment", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", amount: 35000, dealAmount: 100000 });
    const responses = await Promise.all([transfer(f, reward(f).id), a.patch({ comment: "Concurrent comment" })]);
    assert.ok(responses.every((r) => [200, 409].includes(r.status)));
    assert.equal(reward(f).status, "PAID");
    assert.equal(reward(f).amount, 35000);
  } finally { f.close(); }
});

test("parallel registration of normalized email creates one account and one activation code", async () => {
  const f = authFixture(); try {
    const payload = { email: "new@example.test", name: "Synthetic Owner", phone: "+77770000000", password: "ValidPass123", acceptedTerms: true, acceptedPrivacy: true };
    const results = await Promise.all([f.request("/api/auth/register", payload), f.request("/api/auth/register", { ...payload, email: " NEW@EXAMPLE.TEST " })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM users").get().n, 1);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM user_roles").get().n, 1);
    assert.equal(f.deliveries.length, 1);
  } finally { f.close(); }
});

for (const kind of ["email-verification", "reset-password"]) test(`${kind}: superseded codes and concurrent replays cannot create extra sessions or change the password twice`, async () => {
  const f = authFixture(); try {
    const email = "owner@example.test";
    await f.seed(email, kind === "email-verification" ? "pending" : "active");
    const path = `/api/auth/${kind}`;
    const request = (action, extra = {}) => f.request(path, { action, email, password: "ChangedPass123", ...extra });
    await request("REQUEST"); const old = f.deliveries.at(-1).code;
    const table = kind === "email-verification" ? "company_email_verification_codes" : "password_reset_codes";
    f.sqlite.prepare(`UPDATE ${table} SET created_at = ?`).run(new Date(Date.now() - 120000).toISOString());
    await request("REQUEST"); const current = f.deliveries.at(-1).code;
    assert.ok(current);
    const result = await Promise.all([request("CONFIRM", { code: current }), request("CONFIRM", { code: current })]);
    assert.deepEqual(result.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await request("CONFIRM", { code: old })).status, 400);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM auth_sessions").get().n, kind === "email-verification" ? 1 : 0);
  } finally { f.close(); }
});

test("agent login also invalidates old codes and claims the current code once", async () => {
  const f = agentFixture(); try {
    const a = await f.seed();
    const request = (action, code) => f.request("/api/agent/access", { email: a.email, phone: a.phone, action, code });
    await request("REQUEST"); const old = f.deliveries.at(-1).code;
    await request("REQUEST"); const current = f.deliveries.at(-1).code;
    const results = await Promise.all([request("VERIFY", current), request("VERIFY", current)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await request("VERIFY", old)).status, 400);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM agent_sessions").get().n, 1);
  } finally { f.close(); }
});

test("login throttling is atomic and cannot be bypassed by forged forwarded headers", async () => {
  const f = authFixture(); try {
    const results = await Promise.all(Array.from({ length: 18 }, (_, i) => f.request("/api/auth/login", { email: "missing@example.test", password: "bad" }, { "x-forwarded-for": `192.0.2.${i}` })));
    assert.equal(results.filter((r) => r.status === 401).length, 15);
    assert.equal(results.filter((r) => r.status === 429).length, 3);
    assert.ok(results.find((r) => r.status === 429).headers.get("retry-after"));
  } finally { f.close(); }
});

test("normalized unique-index migration preserves rows and fails safely on existing collisions", () => {
  const migration = readFileSync(new URL("../drizzle/0031_sharp_lady_bullseye.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:"); try {
    db.exec("CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT); INSERT INTO users VALUES('1','Person@example.test')");
    db.exec(migration);
    assert.throws(() => db.prepare("INSERT INTO users VALUES('2',?)").run(" person@EXAMPLE.test "), /UNIQUE/);
    assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 1);
    db.exec("DROP INDEX idx_users_email_normalized; INSERT INTO users VALUES('2',' person@EXAMPLE.test ')");
    assert.throws(() => db.exec(migration), /UNIQUE/);
    assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 2);
  } finally { db.close(); }
});

test("report transfers use transfer dates, receipt dates are separate, and currencies never add together", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", amount: 35000, dealAmount: 100000 });
    const id = reward(f).id;
    f.sqlite.prepare("UPDATE rewards SET created_at='2026-08-01T00:00:00Z', approved_at='2026-08-01T00:00:00Z', status='PAID', paid_at='2026-09-02T12:00:00Z', partner_confirmed_at='2026-10-02T12:00:00Z' WHERE id=?").run(id);
    await f.db.insert(f.schema.submissions).values({ id: "usd-lead", companyId: a.companyId, programId: a.programId, missionId: a.missionId, partnerId: a.partnerId, type: "LEAD" });
    await f.db.insert(f.schema.rewards).values({ id: "usd", submissionId: "usd-lead", companyId: a.companyId, partnerId: a.partnerId, amount: 100, currency: "USD", status: "PAID", approvedAt: "2026-08-02T00:00:00Z", paidAt: "2026-09-03T12:00:00Z" });
    const reports = f.load(new URL("../db/reports.ts", import.meta.url));
    const september = await reports.calculatePartnerReportMetrics([a.partnerId], "2026-09-01", "2026-09-30");
    assert.equal(september["paid:KZT"], 35000); assert.equal(september["paid:USD"], 100);
    assert.equal(september.paid, 0); assert.equal(september.confirmed, 0);
    assert.equal(september.paidRewardsCount, 2); assert.equal(september.accrued, 0);
    const october = await reports.calculatePartnerReportMetrics([a.partnerId], "2026-10-01", "2026-10-31");
    assert.equal(october["confirmed:KZT"], 35000); assert.equal(october.paid, 0);
    const august = await reports.calculatePartnerReportMetrics([a.partnerId], "2026-08-01", "2026-08-31");
    assert.equal(august["pending:KZT"], 35000);
  } finally { f.close(); }
});

test("company and agent report views calculate the same scoped metrics", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", amount: 35000, dealAmount: 100000 });
    await f.db.insert(f.schema.agentReports).values({ id: "report", companyId: a.companyId, partnerId: a.partnerId, programId: a.programId, periodStart: "2026-01-01", periodEnd: "2026-12-31", metricsJson: '{"paid":999999}' });
    const reports = f.load(new URL("../db/reports.ts", import.meta.url));
    const [company, agent] = await Promise.all([reports.getCompanyReports(a.companyId), reports.getPartnerReports([a.partnerId])]);
    assert.deepEqual(company[0].metrics, agent[0].metrics);
    assert.equal(agent[0].metrics.paid, 0);
    assert.equal(f.sqlite.prepare("SELECT metrics_json FROM agent_reports").get().metrics_json, '{"paid":999999}');
  } finally { f.close(); }
});

test("monthly sales use the Kazakhstan boundary and ignore later note/transfer events", () => {
  const f = agentFixture(); try {
    const dates = f.load(new URL("../lib/financial-periods.ts", import.meta.url));
    const events = [{ fromStatus: "IN_PROGRESS", toStatus: "REWARDED", createdAt: "2026-08-31T19:00:00Z" }, { fromStatus: "REWARDED", toStatus: "REWARDED", createdAt: "2026-10-02T12:00:00Z" }];
    assert.equal(dates.saleCompletedAt(events), events[0].createdAt);
    assert.equal(dates.withinMonth(dates.saleCompletedAt(events), "2026-09"), true);
    assert.equal(dates.withinMonth("2026-08-31T18:59:59Z", "2026-09"), false);
    assert.equal(dates.withinMonth("2026-09-30T19:00:00Z", "2026-09"), false);
    assert.equal(dates.saleCompletedAt([]), null);
  } finally { f.close(); }
});

test("archive retains history and receipt confirmation but blocks new work and unrelated companies", async () => {
  const f = agentFixture(); try {
    const a = await lead(f);
    await a.patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", dealAmount: 100000, amount: 35000 });
    await transfer(f, reward(f).id);
    f.sqlite.prepare("UPDATE programs SET status='ARCHIVED'").run();
    const portalApi = f.load(new URL("../db/partner.ts", import.meta.url));
    const portal = await portalApi.getPartnerPortal(a.token);
    assert.equal(portal.historyOnly, true); assert.equal(portal.submissions.length, 1); assert.equal(portal.rewards.length, 1);
    assert.equal(portal.missions.length, 0);
    const access = f.load(new URL("../db/agent-access.ts", import.meta.url));
    assert.equal((await access.getAgentWorkspace(a.email, a.phone)).companies.length, 1);
    assert.ok(await access.createCompanyAccessForAgent(a.email, a.phone, a.companyId));
    assert.equal(await access.createCompanyAccessForAgent(a.email, a.phone, "unrelated"), null);
    assert.ok((await f.request("/api/public/submissions", f.form(a))).status >= 400);
    assert.equal((await f.request("/api/partner/actions", { token: a.token, action: "ACCEPT_MISSION", missionId: a.missionId })).status, 400);
    assert.equal((await f.request("/api/partner/actions", { token: a.token, action: "CONFIRM_REWARD", rewardId: reward(f).id, confirmed: true })).status, 200);
    assert.ok(reward(f).partner_confirmed_at);
  } finally { f.close(); }
});
