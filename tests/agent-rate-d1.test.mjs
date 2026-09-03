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
