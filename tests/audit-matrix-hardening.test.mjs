import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the matrix migration adds durable admin sessions, applications, attribution, SLA and reward corrections", async () => {
  const migration = await source("../drizzle/0033_bumpy_viper.sql");
  for (const fragment of ["admin_sessions", "company_applications", "pending_company_registrations", "reward_adjustments", "review_sla_hours", "payout_sla_days", "marketing_attribution_json", "reward_trigger", "is_test"]) {
    assert.match(migration, new RegExp(fragment));
  }
});

test("integration API exposes only working programs and a paused program cannot receive a new lead", async () => {
  const [programs, leads] = await Promise.all([
    source("../app/api/integrations/v1/programs/route.ts"),
    source("../app/api/integrations/v1/leads/route.ts"),
  ]);
  assert.match(programs, /p\.status IN \('ACTIVE',\s*'PAUSED'\)/);
  assert.doesNotMatch(programs, /PUBLISHED/);
  assert.match(leads, /acceptsNewSubmissions/);
  assert.match(leads, /limitIntegrationApi/);
  assert.match(leads, /notifyCompanyNewSubmission/);
});

test("webhook recovery materializes missing deliveries and retries abandoned processing rows", async () => {
  const [service, worker] = await Promise.all([
    source("../lib/integrations/service.ts"),
    source("../worker/index.ts"),
  ]);
  assert.match(service, /materializeMissingDeliveries/);
  assert.match(service, /recoverStaleDeliveries/);
  assert.match(service, /drainDueIntegrationDeliveries/);
  assert.match(worker, /drainDueIntegrationDeliveries/);
  assert.match(worker, /scheduled/);
});

test("a fixed lead can earn on acceptance and its amount is corrected through an immutable journal", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    await f.db.update(f.schema.missions).set({ rewardTrigger: "REVIEW_ACCEPTED" });
    await f.db.insert(f.schema.submissions).values({ id: "lead", companyId: a.companyId, programId: a.programId, missionId: a.missionId, partnerId: a.partnerId, type: "LEAD", contactName: "Client" });
    f.setCompany(a.companyId);
    const accepted = await f.request("/api/submissions/lead", { reviewStatus: "ACCEPTED", salesStatus: "NONE", amount: 25000 }, { method: "PATCH", route: "/api/submissions/[id]", params: { id: "lead" } });
    assert.equal(accepted.status, 200);
    const reward = f.sqlite.prepare("SELECT * FROM rewards WHERE submission_id = 'lead'").get();
    assert.equal(reward.status, "APPROVED");
    const adjusted = await f.request(`/api/rewards/${reward.id}/adjustments`, { amount: 30000, reason: "Согласованная доплата" }, { route: "/api/rewards/[id]/adjustments", params: { id: reward.id } });
    assert.equal(adjusted.status, 200, await adjusted.text());
    assert.equal(f.sqlite.prepare("SELECT amount FROM rewards WHERE id = ?").get(reward.id).amount, 30000);
    const journal = f.sqlite.prepare("SELECT * FROM reward_adjustments WHERE reward_id = ?").get(reward.id);
    assert.equal(journal.previous_amount, 25000);
    assert.equal(journal.difference, 5000);
    assert.equal(journal.reason, "Согласованная доплата");
  } finally { f.close(); }
});

test("company mutations use role permissions while the excluded agent email access remains untouched", async () => {
  const [permissions, program, reward, agentAccess] = await Promise.all([
    source("../lib/company-permissions.ts"),
    source("../app/api/programs/[id]/route.ts"),
    source("../app/api/rewards/[id]/route.ts"),
    source("../app/api/agent/access/route.ts"),
  ]);
  assert.match(permissions, /PROGRAMS_MANAGE/);
  assert.match(permissions, /PAYOUTS_MANAGE/);
  assert.match(program, /hasCompanyPermission/);
  assert.match(reward, /hasCompanyPermission/);
  assert.match(agentAccess, /REQUEST/);
  assert.match(agentAccess, /VERIFY/);
});

test("admin sessions are random, expire server-side and can be revoked", async () => {
  const f = agentFixture();
  try {
    Object.assign(f.runtime, { ADMIN_SECRET: "TestAdminSecret123" });
    const auth = f.load(new URL("../lib/account-auth.ts", import.meta.url));
    assert.equal(await auth.verifyAdminPassword("TestAdminSecret123"), true);
    await auth.createAdminSession();
    assert.equal(await auth.hasAdminSession(), true);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM admin_sessions").get().n, 1);
    f.sqlite.prepare("UPDATE admin_sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    assert.equal(await auth.hasAdminSession(), false);
    await auth.clearAdminSession();
    assert.equal(f.jar.get("relay_admin").value, "");
  } finally { f.close(); }
});

test("a landing application is durable before email and keeps first and last attribution", async (context) => {
  context.mock.method(console, "error", () => {});
  const f = agentFixture();
  try {
    const mail = f.load(new URL("../lib/agent-email.ts", import.meta.url));
    mail.sendCompanyApplicationNotification = async () => { throw new Error("mail unavailable"); };
    const response = await f.request("/api/marketing/company-application", {
      applicationId: "application-12345678", visitId: "visit-1", name: "Owner", company: "School", phone: "+77770000000", email: "owner@example.test", comment: "Pilot",
      firstUtmSource: "google", firstUtmMedium: "cpc", firstUtmCampaign: "launch", lastUtmSource: "instagram", lastUtmMedium: "social", lastUtmCampaign: "retarget",
    });
    assert.equal(response.status, 202);
    const saved = f.sqlite.prepare("SELECT * FROM company_applications WHERE id = 'application-12345678'").get();
    assert.equal(saved.first_utm_source, "google");
    assert.equal(saved.last_utm_source, "instagram");
    assert.equal(saved.notification_status, "FAILED");
    assert.equal(saved.notification_attempts, 1);
    assert.ok(saved.next_notification_at);
    assert.equal(f.sqlite.prepare("SELECT event FROM marketing_events").get().event, "company_application_submitted");
  } finally { f.close(); }
});
