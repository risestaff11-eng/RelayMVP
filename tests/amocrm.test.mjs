import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

const token = "test-secret-bearer-0123456789";
const pipeline = { id: 10, name: "Sales", _embedded: { statuses: [{ id: 11, name: "New" }, { id: 12, name: "Work" }, { id: 142, name: "Won" }, { id: 143, name: "Lost" }] } };

async function fixture() {
  const f = agentFixture();
  // D1 .all() includes per-statement changes in batch responses. The shared
  // fixture only models rows; the ingestion idempotency gate also needs metadata.
  const prepare = f.binding.prepare.bind(f.binding);
  f.binding.prepare = query => {
    const statement = prepare(query);
    const all = statement.all.bind(statement);
    statement.all = async () => { const result = await all(); return { ...result, meta: { changes: f.sqlite.prepare("SELECT changes() AS n").get().n } }; };
    return statement;
  };
  f.runtime.INTEGRATION_ENCRYPTION_KEY = "isolated-test-integration-encryption-key";
  const identity = await f.seed();
  f.setCompany(identity.companyId);
  await f.db.insert(f.schema.submissions).values({ id: "lead-a", companyId: identity.companyId, programId: identity.programId, missionId: identity.missionId, partnerId: identity.partnerId, type: "LEAD", contactName: "Client", contactPhone: "+77012223344", estimatedDealAmount: 100000, payloadJson: JSON.stringify({ partnerComment: "Interested in course" }) });
  const service = f.load(new URL("../lib/integrations/amocrm.ts", import.meta.url));
  return { f, identity, service };
}

function provider() {
  const calls = [];
  let created = null;
  let price = 100000;
  let status = 12;
  let mode = "ok";
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.authorization, `Bearer ${token}`);
    const path = new URL(url).pathname;
    if (path === "/api/v4/account") return Response.json({ id: 77, name: "Test account", currency: "KZT" });
    if (path === "/api/v4/leads/pipelines") return Response.json({ _embedded: { pipelines: [pipeline] } });
    if (path === "/api/v4/leads/custom_fields") return Response.json({ _embedded: { custom_fields: [{ id: 101, code: "RISESTAFF_ID", type: "text" }, { id: 102, code: "RISESTAFF_CONTEXT", type: "textarea" }] } });
    if (path === "/api/v4/leads/complex") {
      const body = JSON.parse(options.body);
      created = { ...body[0], id: 501 };
      if (mode === "timeout") throw new Error("lost response");
      return Response.json([{ id: 501, merged: mode === "merged" }]);
    }
    if (path === "/api/v4/leads") return Response.json({ _embedded: { leads: created ? [created] : [] } });
    if (path === "/api/v4/leads/501") return Response.json({ ...created, pipeline_id: 10, status_id: status, price });
    throw new Error(`Unexpected request ${path}`);
  };
  return { calls, restore() { globalThis.fetch = original; }, set mode(v) { mode = v; }, set status(v) { status = v; }, set price(v) { price = v; }, get created() { return created; } };
}

async function connect(service, companyId) {
  return service.connectAmo(companyId, { url: "https://test.amocrm.ru", token, pipelineId: 10, initialStatusId: 11, currency: "KZT", stageMap: { 12: "IN_PROGRESS", 143: "LOST" }, paidStatusId: 142, confirmFullPayment: true });
}

test("amoCRM only accepts trusted account origins and full payment needs an explicit mapping", () => {
  const { amoOrigin, amoStage } = typescriptLoader()(new URL("../lib/integrations/amocrm-client.ts", import.meta.url));
  assert.equal(amoOrigin("https://test.amocrm.ru/"), "https://test.amocrm.ru");
  for (const value of ["http://test.amocrm.ru", "https://test.amocrm.ru.evil.test", "https://test.amocrm.ru@evil.test", "https://127.0.0.1", "https://test.amocrm.ru/path", "https://test.amocrm.ru:8443"]) assert.throws(() => amoOrigin(value));
  assert.equal(amoStage({ paidStatusId: null, stageMap: {} }, 142, 999), null);
  assert.throws(() => amoStage({ paidStatusId: 142 }, 142, 0));
  assert.equal(amoStage({ paidStatusId: 142 }, 142, 100).salesStatus, "WON");
});

test("connect is paused, encrypted and scoped; one lead makes one deal with contact and attribution", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId);
    const row = f.sqlite.prepare("SELECT * FROM integration_connections").get();
    assert.equal(row.status, "PAUSED");
    assert.ok(!row.encrypted_credentials.includes(token));
    assert.equal(p.calls.filter(c => c.options.method === "POST").length, 0, "inspection reuses existing fields and creates no clients");
    await assert.rejects(service.amoConnection("other-company", id), /не найдено/);
    await assert.rejects(service.deliverAmo(identity.companyId, id, "lead-a"), /не найдено/);
    await service.updateAmo(identity.companyId, id, { status: "ACTIVE" });
    await Promise.allSettled([service.deliverAmo(identity.companyId, id, "lead-a"), service.deliverAmo(identity.companyId, id, "lead-a")]);
    await service.deliverAmo(identity.companyId, id, "lead-a");
    assert.equal(p.calls.filter(c => c.url.endsWith("/complex")).length, 1);
    assert.equal(p.created._embedded.contacts[0].custom_fields_values[0].field_code, "PHONE");
    assert.ok(p.created.custom_fields_values[1].values[0].value.includes("partner-a") === false);
    assert.match(p.created.custom_fields_values[1].values[0].value, /Ambassador/);
    assert.match(p.created.custom_fields_values[1].values[0].value, /Interested in course/);
    assert.equal(f.sqlite.prepare("SELECT external_id FROM external_entity_links").get().external_id, "501");
  } finally { p.restore(); f.close(); }
});

test("a lost create response reconciles the existing deal instead of duplicating it", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId); await service.updateAmo(identity.companyId, id, { status: "ACTIVE" });
    p.mode = "timeout";
    await assert.rejects(service.deliverAmo(identity.companyId, id, "lead-a"), /не ответила/);
    assert.match(f.sqlite.prepare("SELECT external_id FROM external_entity_links").get().external_id, /^pending:/);
    await service.deliverAmo(identity.companyId, id, "lead-a");
    assert.equal(p.calls.filter(c => c.url.endsWith("/complex")).length, 1);
    assert.equal(f.sqlite.prepare("SELECT external_id FROM external_entity_links").get().external_id, "501");
  } finally { p.restore(); f.close(); }
});

test("merged deals block attribution; currency mismatch sends nothing", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId); await service.updateAmo(identity.companyId, id, { status: "ACTIVE" });
    f.sqlite.prepare("UPDATE programs SET currency='USD'").run();
    await assert.rejects(service.deliverAmo(identity.companyId, id, "lead-a"), /Валюты/);
    assert.equal(p.calls.filter(c => c.url.endsWith("/complex")).length, 0);
    f.sqlite.prepare("UPDATE programs SET currency='KZT'").run(); p.mode = "merged";
    await assert.rejects(service.deliverAmo(identity.companyId, id, "lead-a"), /авторства/);
    await assert.rejects(service.deliverAmo(identity.companyId, id, "lead-a"), /авторства/);
    assert.equal(p.calls.filter(c => c.url.endsWith("/complex")).length, 1);
  } finally { p.restore(); f.close(); }
});

test("CRM stages reuse rewards workflow, notify agent and never confirm a transfer", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId); await service.updateAmo(identity.companyId, id, { status: "ACTIVE" });
    await service.deliverAmo(identity.companyId, id, "lead-a");
    assert.equal((await service.syncAmo(identity.companyId, id)).updated, 1);
    assert.equal(f.sqlite.prepare("SELECT sales_status FROM submissions").get().sales_status, "IN_PROGRESS");
    p.status = 142;
    const paid = await service.syncAmo(identity.companyId, id);
    assert.deepEqual(paid.errors, []);
    assert.equal(paid.updated, 1);
    assert.equal(f.sqlite.prepare("SELECT deal_amount FROM submissions").get().deal_amount, 100000);
    const reward = f.sqlite.prepare("SELECT * FROM rewards").get();
    assert.equal(reward.amount, 25000); assert.equal(reward.status, "APPROVED");
    assert.equal(reward.paid_at, null); assert.equal(reward.partner_confirmed_at, null);
    const events = f.sqlite.prepare("SELECT COUNT(*) AS n FROM submission_status_events").get().n;
    assert.equal((await service.syncAmo(identity.companyId, id)).updated, 0);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM submission_status_events").get().n, events);
    const portal = await f.load(new URL("../db/partner.ts", import.meta.url)).getPartnerPortal(identity.token);
    assert.equal(portal.submissions[0].salesStatus, "WON");
    assert.equal(portal.submissions[0].reward.amount, 25000);
    assert.ok(f.deliveries.some(d => d.type === "work-update"));
    f.sqlite.prepare("UPDATE submissions SET ownership_status='DISPUTED'").run();
    p.price = 200000;
    assert.equal((await service.syncAmo(identity.companyId, id)).updated, 0);
    assert.equal(f.sqlite.prepare("SELECT deal_amount FROM submissions").get().deal_amount, 100000);
    f.sqlite.prepare("UPDATE submissions SET ownership_status='CLEAR'").run();
    f.sqlite.prepare("UPDATE rewards SET status='PAID', paid_at='2026-01-01T00:00:00Z'").run();
    const settled = await service.syncAmo(identity.companyId, id);
    assert.equal(settled.updated, 0); assert.equal(settled.errors.length, 1);
    assert.equal(f.sqlite.prepare("SELECT amount FROM rewards").get().amount, 25000);
  } finally { p.restore(); f.close(); }
});

test("queue delivers only post-connection leads and excludes old history", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId); await service.updateAmo(identity.companyId, id, { status: "ACTIVE" });
    const events = f.load(new URL("../lib/integrations/service.ts", import.meta.url));
    await events.recordIntegrationEvent({ companyId: identity.companyId, eventType: "submission.created", aggregateType: "submission", aggregateId: "old-lead", payload: {}, idempotencyKey: "old-history" });
    f.sqlite.prepare("UPDATE integration_events SET created_at='2020-01-01T00:00:00Z'").run();
    await events.recordIntegrationEvent({ companyId: identity.companyId, eventType: "submission.created", aggregateType: "submission", aggregateId: "lead-a", payload: {}, idempotencyKey: "new-lead" });
    await events.dispatchPendingDeliveries(identity.companyId);
    assert.equal(p.calls.filter(c => c.url.endsWith("/complex")).length, 1);
    const rows = f.sqlite.prepare("SELECT * FROM integration_deliveries").all();
    assert.equal(rows.length, 1); assert.equal(rows[0].status, "DELIVERED");
  } finally { p.restore(); f.close(); }
});

test("API intake preserves source/UTM and replay identity; invalid tenant cannot change a CRM connection", async () => {
  const { f, identity, service } = await fixture(); const p = provider();
  try {
    const { id } = await connect(service, identity.companyId);
    f.setCompany(null);
    assert.equal((await f.request("/api/company/integrations/amocrm", { action: "inspect", url: "https://test.amocrm.ru", token })).status, 401);
    const other = await f.seed({ companyId: "other", programId: "other-program", partnerId: "other-agent" });
    f.setCompany(other.companyId);
    assert.equal((await f.request(`/api/company/integrations/amocrm/${id}`, { status: "ACTIVE" }, { method: "PATCH", route: "/api/company/integrations/amocrm/[id]", params: { id } })).status, 400);
    assert.equal(f.sqlite.prepare("SELECT status FROM integration_connections WHERE id=?").get(id).status, "PAUSED");
    const integration = f.load(new URL("../lib/integrations/service.ts", import.meta.url));
    const key = await integration.createApiKey(identity.companyId, { name: "Inbound", scopes: ["leads:write"] });
    const input = { programId: identity.programId, missionId: identity.missionId, partnerId: identity.partnerId, contactName: "Second client", contactPhone: "+77019998877", source: "landing-form", utm_source: "partner", utm_medium: "referral", utm_campaign: "courses", externalId: "form-100" };
    const request = () => f.request("/api/integrations/v1/leads", input, { headers: { authorization: `Bearer ${key.token}`, "idempotency-key": "form-100-key" } });
    const result = await request(); assert.equal(result.status, 201);
    const { data: { submissionId } } = await result.json();
    const payload = JSON.parse(f.sqlite.prepare("SELECT payload_json FROM submissions WHERE id=?").get(submissionId).payload_json);
    assert.equal(payload.referralSource, "landing-form");
    assert.equal(payload.attribution.utmCampaign, "courses");
    assert.equal(payload.attribution.externalId, "form-100");
    const { data: replay } = await (await request()).json();
    assert.equal(replay.submissionId, submissionId); assert.equal(replay.duplicateRequest, true);
  } finally { p.restore(); f.close(); }
});
