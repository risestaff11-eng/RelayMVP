import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

// Exercise the installed Cloudflare D1 emulator, in addition to SQLite fixture
// tests. Reuse Wrangler's pinned dependency; do not contact any hosted database.
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve("wrangler"))("miniflare");

test("D1 executes the migration and concurrent limiter/verification batches atomically", { timeout: 45000 }, async () => {
  const runtime = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('test'); } };", d1Databases: ["DB"], compatibilityDate: "2026-05-15" });
  try {
    const DB = await runtime.getD1Database("DB");
    const migration = await readFile(new URL("../drizzle/0030_request_rate_limits.sql", import.meta.url), "utf8");
    await DB.batch(migration.split("--> statement-breakpoint").map((statement) => DB.prepare(statement.trim())));
    const load = typescriptLoader({ "cloudflare:workers": { env: { DB } } });
    const { takeRequestLimit } = load(new URL("../lib/request-rate-limit.ts", import.meta.url));
    const attempts = await Promise.all(Array.from({ length: 12 }, () => takeRequestLimit("contact-code-confirm", "test-only", 5)));
    assert.equal(attempts.filter((result) => result.allowed).length, 5);
    assert.equal((await DB.prepare("SELECT hits FROM request_rate_limits").first()).hits, 6);

    // Replay protection depends on SQLite changes() staying within one D1 batch.
    await DB.batch([
      DB.prepare("CREATE TABLE test_profile (id TEXT PRIMARY KEY, verified_at TEXT)"),
      DB.prepare("CREATE TABLE test_code (id TEXT PRIMARY KEY, consumed_at TEXT)"),
      DB.prepare("INSERT INTO test_profile (id) VALUES ('test')"),
      DB.prepare("INSERT INTO test_code (id) VALUES ('test')"),
    ]);
    const confirm = () => DB.batch([
      DB.prepare("UPDATE test_profile SET verified_at = 'confirmed' WHERE id = 'test' AND EXISTS (SELECT 1 FROM test_code WHERE id = 'test' AND consumed_at IS NULL)"),
      DB.prepare("UPDATE test_code SET consumed_at = 'confirmed' WHERE id = 'test' AND consumed_at IS NULL AND changes() = 1 RETURNING id"),
    ]);
    const confirmations = await Promise.all(Array.from({ length: 6 }, confirm));
    assert.equal(confirmations.filter((result) => result[1].results.length === 1).length, 1);
  } finally { await runtime.dispose(); }
});

test("D1 enforces normalized email uniqueness, claims email codes once and protects confirmed transfers", { timeout: 45000 }, async () => {
  const runtime = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('test'); } };", d1Databases: ["DB"], compatibilityDate: "2026-05-15" });
  try {
    const DB = await runtime.getD1Database("DB");
    await DB.batch([
      DB.prepare("CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT NOT NULL)"),
      DB.prepare("CREATE TABLE company_email_verification_codes(id TEXT PRIMARY KEY, user_id TEXT, destination TEXT, attempts INTEGER DEFAULT 0, consumed_at TEXT, expires_at TEXT, created_at TEXT)"),
      DB.prepare("CREATE TABLE submissions(id TEXT PRIMARY KEY, status TEXT)"),
      DB.prepare("CREATE TABLE rewards(id TEXT PRIMARY KEY, submission_id TEXT, company_id TEXT, partner_id TEXT, status TEXT, paid_at TEXT, partner_confirmed_at TEXT, updated_at TEXT)"),
      DB.prepare("CREATE TABLE submission_status_events(id TEXT PRIMARY KEY, submission_id TEXT, from_status TEXT, to_status TEXT, actor_type TEXT, comment TEXT, created_at TEXT)"),
    ]);
    await DB.prepare(await readFile(new URL("../drizzle/0031_sharp_lady_bullseye.sql", import.meta.url), "utf8")).run();
    await DB.prepare("INSERT INTO users VALUES('u','Owner@example.test')").run();
    await assert.rejects(DB.prepare("INSERT INTO users VALUES('other',' owner@EXAMPLE.test ')").run(), /UNIQUE/);
    const now = new Date().toISOString();
    await DB.prepare("INSERT INTO company_email_verification_codes(id,user_id,destination,expires_at,created_at) VALUES('code','u','owner@example.test',?,?)")
      .bind(new Date(Date.now() + 600000).toISOString(), now).run();
    const load = typescriptLoader({ "cloudflare:workers": { env: { DB } } });
    const { claimEmailCode } = load(new URL("../lib/email-code-lifecycle.ts", import.meta.url));
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimEmailCode("company_email_verification_codes", "code", now)));
    assert.equal(claims.filter(Boolean).length, 1);
    await DB.prepare("INSERT INTO submissions VALUES('lead','REWARDED')").run();
    await DB.prepare("INSERT INTO rewards(id,submission_id,company_id,partner_id,status) VALUES('reward','lead','company','agent','APPROVED')").run();
    const { recordRewardTransfer, recordRewardReceipt } = load(new URL("../lib/reward-transfer.ts", import.meta.url));
    const transfers = await Promise.all(Array.from({ length: 4 }, () => recordRewardTransfer("company", "reward", true)));
    assert.equal(transfers.filter(Boolean).length, 1);
    assert.ok(await recordRewardReceipt("agent", "reward"));
    assert.equal(await recordRewardTransfer("company", "reward", false), undefined);
    assert.equal((await DB.prepare("SELECT status FROM rewards").first()).status, "PAID");
    assert.equal((await DB.prepare("SELECT count(*) n FROM submission_status_events").first()).n, 2);
  } finally { await runtime.dispose(); }
});
