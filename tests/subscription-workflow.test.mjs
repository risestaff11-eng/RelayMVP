import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { agentFixture } from "./helpers/agent-fixture.mjs";

const moduleUrl = (path) => new URL(`../${path}`, import.meta.url);
const now = new Date("2026-09-12T00:00:00.000Z");
const input = (revision, extra = {}) => ({ requestId: crypto.randomUUID(), revision, action: "ACTIVATE", planCode: "STARTER", days: 30, paidAmount: 19900, grantCredits: true, note: "Synthetic test payment", ...extra });
function installTriggers(f) { f.sqlite.exec(readFileSync(moduleUrl("drizzle/0035_subscription_guards.sql"), "utf8")); }

test("14-day trial expires at the boundary; plan gates and legacy compatibility are explicit", () => {
  const f = agentFixture(); try {
    const { newTrial, subscriptionState, subscriptionAllows } = f.load(moduleUrl("lib/subscription-plans.ts"));
    const trial = newTrial(now);
    assert.equal(trial.subscriptionEndsAt, "2026-09-26T00:00:00.000Z");
    assert.equal(subscriptionState(trial, now.getTime()).programs, 5);
    assert.equal(subscriptionAllows(trial, "INTEGRATIONS", Date.parse(trial.subscriptionEndsAt) - 1), true);
    assert.equal(subscriptionAllows(trial, "CORE", Date.parse(trial.subscriptionEndsAt)), false);
    for (const [planCode, reports, integrations, programs] of [["STARTER", false, false, 1], ["GROWTH", true, false, 5], ["SCALE", true, true, 20]]) {
      const company = { planCode, subscriptionStatus: "ACTIVE", subscriptionEndsAt: "2026-10-12T00:00:00Z" };
      assert.equal(subscriptionAllows(company, "REPORTS", now.getTime()), reports);
      assert.equal(subscriptionAllows(company, "INTEGRATIONS", now.getTime()), integrations);
      assert.equal(subscriptionState(company, now.getTime()).programs, programs);
      assert.equal(subscriptionAllows({ ...company, subscriptionStatus: "SUSPENDED" }, "CORE", now.getTime()), false);
      assert.equal(subscriptionAllows({ ...company, subscriptionEndsAt: "invalid" }, "CORE", now.getTime()), false);
    }
    assert.equal(subscriptionAllows({ planCode: "LEGACY", subscriptionStatus: "LEGACY" }, "CORE"), true);
  } finally { f.close(); }
});

test("manual activation is idempotent, renews remaining days and journals one credit grant", async () => {
  const f = agentFixture(); try {
    installTriggers(f); await f.seed();
    const { changeSubscription } = f.load(moduleUrl("lib/subscription-admin.ts"));
    const original = f.sqlite.prepare("SELECT ai_token_balance balance FROM companies").get().balance;
    const request = input(0);
    await changeSubscription("company-a", "admin-session-test", request, now);
    await changeSubscription("company-a", "admin-session-test", request, now);
    assert.equal(f.sqlite.prepare("SELECT ai_token_balance balance FROM companies").get().balance, original + 50000);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM subscription_events").get().n, 1);
    const renewal = await changeSubscription("company-a", "admin-session-test", input(1, { action: "EXTEND", grantCredits: false }), now);
    assert.equal(renewal.endsAt, "2026-11-11T00:00:00.000Z");
    await assert.rejects(changeSubscription("company-a", "admin-session-test", input(1), now), /Тариф уже изменён/);
    await assert.rejects(changeSubscription("company-a", "admin-session-test", input(2, { paidAmount: -1 }), now), /сумму/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM product_milestones WHERE event='first_renewal'").get().n, 1);
    const results = await Promise.allSettled([changeSubscription("company-a", "one", input(2), now), changeSubscription("company-a", "two", input(2), now)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(f.sqlite.prepare("SELECT subscription_revision n FROM companies").get().n, 3);
  } finally { f.close(); }
});

test("program limit survives direct concurrent publication and allows pausing existing programs", async () => {
  const f = agentFixture(); try {
    installTriggers(f); await f.seed(); f.setCompany("company-a");
    f.sqlite.exec("UPDATE companies SET plan_code='STARTER', subscription_status='ACTIVE', subscription_ends_at='2099-01-01T00:00:00Z'");
    await f.seed({ programId: "second", partnerId: "second-agent", status: "DRAFT" });
    assert.throws(() => f.sqlite.prepare("UPDATE programs SET status='ACTIVE' WHERE id='second'").run(), /PROGRAM_LIMIT_REACHED/);
    const patch = (id, status) => f.request(`/api/programs/${id}/status`, { status }, { method: "PATCH", route: "/api/programs/[id]/status", params: { id } });
    assert.equal((await patch("second", "ACTIVE")).status, 402);
    assert.equal((await patch("program-a", "PAUSED")).status, 200);
    assert.equal((await patch("program-a", "ARCHIVED")).status, 200);
    assert.equal((await patch("second", "ACTIVE")).status, 200);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM product_milestones WHERE event='first_program_published'").get().n, 1);
  } finally { f.close(); }
});

test("expired access stops new leads and writes, but preserves viewing, export and reward settlement", async () => {
  const f = agentFixture(); try {
    const a = await f.seed(); f.setCompany(a.companyId);
    await f.db.insert(f.schema.submissions).values({ id: "lead", companyId: a.companyId, programId: a.programId, missionId: a.missionId, partnerId: a.partnerId, type: "LEAD" });
    const patch = (body) => f.request("/api/submissions/lead", body, { method: "PATCH", route: "/api/submissions/[id]", params: { id: "lead" } });
    assert.equal((await patch({ reviewStatus: "ACCEPTED", salesStatus: "WON", dealAmount: 100000 })).status, 200);
    const reward = f.sqlite.prepare("SELECT id FROM rewards").get();
    f.sqlite.exec("UPDATE companies SET subscription_status='ACTIVE',plan_code='SCALE',subscription_ends_at='2020-01-01T00:00:00Z'");
    assert.equal((await patch({ comment: "Not permitted" })).status, 402);
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 402);
    assert.equal((await f.request("/api/company/crm", undefined, { method: "GET" })).status, 200);
    assert.equal((await f.request("/api/company/export", undefined, { method: "GET" })).status, 200);
    assert.equal((await f.request(`/api/rewards/${reward.id}`, { paid: true }, { method: "PATCH", route: "/api/rewards/[id]", params: { id: reward.id } })).status, 200);
    assert.equal((await f.request("/api/partner/actions", { token: a.token, action: "CONFIRM_REWARD", rewardId: reward.id, confirmed: true })).status, 200);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM submissions").get().n, 1);
    assert.equal((await f.request("/api/system/companies/company-a/subscription", input(0), { method: "PATCH", route: "/api/system/companies/[id]/subscription", params: { id: "company-a" } })).status, 403);
  } finally { f.close(); }
});
