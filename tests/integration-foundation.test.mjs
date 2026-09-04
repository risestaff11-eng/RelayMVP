import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("webhook URLs require public HTTPS endpoints and reject loops", () => {
  const { normalizeWebhookUrl } = typescriptLoader()(new URL("../lib/integrations/url.ts", import.meta.url));
  assert.equal(normalizeWebhookUrl("https://crm.example.kz/hooks#fragment"), "https://crm.example.kz/hooks");
  for (const value of ["http://crm.example.kz/hook", "https://localhost/hook", "https://127.0.0.1/hook", "https://192.168.1.2/hook", "https://company.risestaff.kz/api"]) {
    assert.throws(() => normalizeWebhookUrl(value));
  }
});

test("integration secrets encrypt with random IVs, decrypt and sign deterministically", async () => {
  const runtime = { INTEGRATION_ENCRYPTION_KEY: "test-key-that-is-long-and-kept-out-of-source" };
  const cryptoModule = typescriptLoader({ "cloudflare:workers": { env: runtime } })(new URL("../lib/integrations/crypto.ts", import.meta.url));
  const first = await cryptoModule.encryptIntegrationSecret("secret-value");
  const second = await cryptoModule.encryptIntegrationSecret("secret-value");
  assert.match(first, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.equal(await cryptoModule.decryptIntegrationSecret(first), "secret-value");
  assert.equal(await cryptoModule.signWebhook("secret", "100", "{}"), await cryptoModule.signWebhook("secret", "100", "{}"));
});

test("migration creates the queue, attempt journal, API keys and external mappings", async () => {
  const migration = await source("../drizzle/0032_neat_sebastian_shaw.sql");
  for (const table of ["integration_connections", "integration_events", "integration_deliveries", "integration_delivery_attempts", "integration_api_keys", "external_entity_links"]) {
    assert.ok(migration.includes("CREATE TABLE `" + table + "`"));
  }
  assert.match(migration, /integration_events_idempotency_key_unique/);
  assert.match(migration, /idx_integration_deliveries_event_connection/);
});

test("company settings expose integrations outside the sidebar and business routes emit stable event types", async () => {
  const [nav, settings, page, service, leadRoute, updateRoute, rewardRoute] = await Promise.all([
    source("../app/dashboard/_components/dashboard-nav.tsx"),
    source("../app/dashboard/settings/plan-settings.tsx"),
    source("../app/dashboard/integrations/integration-manager.tsx"),
    source("../lib/integrations/service.ts"),
    source("../app/api/public/submissions/route.ts"),
    source("../app/api/submissions/[id]/route.ts"),
    source("../app/api/rewards/[id]/route.ts"),
  ]);
  assert.doesNotMatch(nav, /\/dashboard\/(integrations|notifications)/);
  assert.match(settings, /\/dashboard\/integrations/);
  assert.match(settings, /\/dashboard\/notifications/);
  assert.match(page, /Исходящие webhooks/);
  assert.match(page, /Журнал доставки/);
  assert.match(service, /"submission\.created"/);
  assert.match(service, /"submission\.updated"/);
  assert.match(service, /"reward\.updated"/);
  assert.match(leadRoute, /eventType: "submission\.created"/);
  assert.match(updateRoute, /eventType: "submission\.updated"/);
  assert.match(rewardRoute, /eventType: "reward\.updated"/);
});

test("public API v1 authenticates scopes and lead writes require idempotency", async () => {
  const [ping, programs, agents, leads] = await Promise.all([
    source("../app/api/integrations/v1/ping/route.ts"),
    source("../app/api/integrations/v1/programs/route.ts"),
    source("../app/api/integrations/v1/agents/route.ts"),
    source("../app/api/integrations/v1/leads/route.ts"),
  ]);
  assert.match(ping, /integrations:read/);
  assert.match(programs, /programs:read/);
  assert.match(agents, /agents:read/);
  assert.match(leads, /leads:write/);
  assert.match(leads, /idempotency-key/);
  assert.match(leads, /DUPLICATE_CONTACT/);
});
