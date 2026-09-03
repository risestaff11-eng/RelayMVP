import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { agentFixture } from "./helpers/agent-fixture.mjs";

const limiter = (f) => f.load(new URL("../lib/request-rate-limit.ts", import.meta.url));
const ip = (address) => ({ headers: { "cf-connecting-ip": address } });

test("rate counters are atomic, capped, scoped and expire without extending a block", async () => {
  const f = agentFixture();
  try {
    const { takeRequestLimit, readRequestLimit, RATE_LIMIT_WINDOW_MS } = limiter(f);
    const now = Date.now();
    const attempts = await Promise.all(Array.from({ length: 60 }, () => takeRequestLimit("public-submission-ip", "203.0.113.7", 30, now)));
    assert.equal(attempts.filter((result) => result.allowed).length, 30);
    const counter = f.sqlite.prepare("SELECT * FROM request_rate_limits").get();
    assert.equal(counter.hits, 31);
    assert.equal(counter.reset_at, now + RATE_LIMIT_WINDOW_MS);
    assert.match(counter.key_hash, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(counter).includes("203.0.113.7"));
    const blocked = await takeRequestLimit("public-submission-ip", "203.0.113.7", 30, now + 60000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 840);
    assert.equal((await takeRequestLimit("contact-code-confirm", "203.0.113.7", 5, now)).allowed, true);
    assert.equal((await takeRequestLimit("public-submission-ip", "203.0.113.8", 30, now)).allowed, true);
    assert.equal((await readRequestLimit("public-submission-ip", "203.0.113.7", 30, now + RATE_LIMIT_WINDOW_MS)).allowed, true);
    const next = await takeRequestLimit("public-submission-ip", "203.0.113.7", 30, now + RATE_LIMIT_WINDOW_MS);
    assert.equal(next.allowed, true);
    assert.equal(next.remaining, 29);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM request_rate_limits").get().n, 1);
  } finally { f.close(); }
});

test("both public intake routes share one IP budget and reject excess traffic before saving a lead", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    for (let index = 0; index < 30; index++) {
      const options = { headers: { "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": `192.0.2.${index}` } };
      const response = index % 2 ? await f.request("/api/public/referrals/submit", { website_url: "bot" }, options) : await f.request("/api/public/submissions", f.form(a, { website_url: "bot" }), options);
      assert.equal(response.status, 400);
    }
    const blocked = await f.request("/api/public/submissions", f.form(a), ip("203.0.113.1"));
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal((await blocked.json()).code, "RATE_LIMITED");
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.objects.size, 0);
    assert.equal((await f.request("/api/public/submissions", f.form(a), ip("203.0.113.2"))).status, 201);
  } finally { f.close(); }
});

test("IP normalization ignores forged forwarding headers and combines equivalent IPv6 addresses", () => {
  const f = agentFixture();
  try {
    const { requestIpKey } = limiter(f);
    const key = (headers) => requestIpKey(new Request("https://agents.risestaff.kz", { headers }));
    assert.equal(key({ "x-forwarded-for": "203.0.113.1" }), key({ "x-forwarded-for": "203.0.113.2" }));
    assert.equal(key({ "cf-connecting-ip": "2001:db8::1" }), key({ "cf-connecting-ip": "2001:0DB8:0000:0000:0000:0000:0000:0001" }));
    assert.equal(key({ "cf-connecting-ip": "not-an-ip" }), "unidentified-ip");
  } finally { f.close(); }
});

test("counter outage fails closed with a recoverable error and no business side effects", async () => {
  const f = agentFixture({ rateTable: false });
  try {
    const a = await f.seed();
    for (const [path, data] of [["/api/public/submissions", f.form(a)], ["/api/public/referrals/submit", { referralToken: a.referralToken, name: "Client", contact: "+77012223344" }], ["/api/partner/verify", { action: "REQUEST", channel: "EMAIL", token: a.token }]]) {
      const response = await f.request(path, data);
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.code, "RATE_LIMIT_UNAVAILABLE");
      assert.ok(!body.error.includes("request_rate_limits"));
    }
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM contact_verification_codes").get().n, 0);
    assert.equal(f.deliveries.length, 0);
  } finally { f.close(); }
});

test("0030 migration adds only the counter table/index and leaves existing records unchanged", async () => {
  const f = agentFixture({ rateTable: false });
  try {
    await f.seed();
    const tables = f.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name);
    const before = Object.fromEntries(tables.map((name) => [name, f.sqlite.prepare(`SELECT * FROM "${name}"`).all()]));
    const migration = await readFile(new URL("../drizzle/0030_request_rate_limits.sql", import.meta.url), "utf8");
    f.sqlite.exec(migration);
    for (const name of tables) assert.deepEqual(f.sqlite.prepare(`SELECT * FROM "${name}"`).all(), before[name], name);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM request_rate_limits").get().n, 0);
    const plan = f.sqlite.prepare("EXPLAIN QUERY PLAN SELECT key_hash FROM request_rate_limits WHERE reset_at <= ? ORDER BY reset_at LIMIT 100").all(Date.now());
    assert.ok(plan.some((row) => row.detail.includes("idx_request_rate_limits_reset_at")));
  } finally { f.close(); }
});
