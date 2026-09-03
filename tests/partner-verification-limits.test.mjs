import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

function verificationFixture() {
  const f = agentFixture();
  const originalFetch = globalThis.fetch;
  const codes = [];
  Object.assign(f.runtime, { RESEND_API_KEY: "test-only", MAGIC_FROM_EMAIL: "sender@example.test", WHATSAPP_VERIFY_WEBHOOK_URL: "https://verify.example.test" });
  let sequence = 300000;
  f.load(new URL("../lib/verification-code.ts", import.meta.url)).createVerificationCode = () => String(++sequence);
  globalThis.fetch = async (url, options) => {
    assert.ok(["https://api.resend.com/emails", "https://verify.example.test"].includes(url));
    const payload = JSON.parse(options.body);
    codes.push(payload.code ?? payload.html.match(/<strong>(\d{6})<\/strong>/)[1]);
    return new Response("{}");
  };
  return { ...f, codes,
    verify(token, action, code, channel = "EMAIL") { return f.request("/api/partner/verify", { token, action, code, channel }, { headers: { "cf-connecting-ip": "203.0.113.10" } }); },
    close() { globalThis.fetch = originalFetch; f.close(); },
  };
}

test("five failed contact codes block verification and resend; a new access token cannot bypass the block", async () => {
  const f = verificationFixture();
  try {
    const a = await f.seed();
    assert.equal((await f.verify(a.token, "REQUEST")).status, 200);
    for (let count = 1; count <= 5; count++) assert.equal((await f.verify(a.token, "CONFIRM", "000000")).status, count === 5 ? 429 : 400);
    assert.equal((await f.verify(a.token, "CONFIRM", f.codes[0])).status, 429);
    assert.equal((await f.verify(a.token, "REQUEST")).status, 429);
    const token = await f.load(new URL("../db/agent-access.ts", import.meta.url)).createCompanyAccessForAgent(a.email, a.phone, a.companyId);
    assert.equal((await f.verify(token, "REQUEST")).status, 429);
    assert.equal(f.codes.length, 1);
    assert.equal(f.sqlite.prepare("SELECT email_verified_at FROM partner_profiles").get().email_verified_at, null);
    f.sqlite.prepare("UPDATE request_rate_limits SET reset_at = ?").run(Date.now() - 1);
    assert.equal((await f.verify(a.token, "REQUEST")).status, 200);
    assert.equal((await f.verify(a.token, "CONFIRM", f.codes.at(-1))).status, 200);
    assert.ok(f.sqlite.prepare("SELECT email_verified_at FROM partner_profiles").get().email_verified_at);
  } finally { f.close(); }
});

test("reissuing a code neither resets attempts nor resurrects superseded codes", async () => {
  const f = verificationFixture();
  try {
    const a = await f.seed();
    await f.verify(a.token, "REQUEST");
    const oldCode = f.codes[0];
    for (let count = 0; count < 3; count++) assert.equal((await f.verify(a.token, "CONFIRM", "000000")).status, 400);
    await f.verify(a.token, "REQUEST");
    assert.equal((await f.verify(a.token, "CONFIRM", oldCode)).status, 400);
    assert.equal((await f.verify(a.token, "CONFIRM", f.codes.at(-1))).status, 200);
    assert.equal((await f.verify(a.token, "CONFIRM", oldCode)).status, 429);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM contact_verification_codes WHERE consumed_at IS NULL").get().n, 0);
  } finally { f.close(); }
});

test("parallel guesses have exactly five verification slots; a correct code can be consumed only once", async () => {
  const f = verificationFixture();
  try {
    const a = await f.seed();
    await f.verify(a.token, "REQUEST");
    const guesses = await Promise.all(Array.from({ length: 20 }, () => f.verify(a.token, "CONFIRM", "000000")));
    assert.equal(guesses.filter((response) => response.status === 400).length, 4);
    assert.equal(guesses.filter((response) => response.status === 429).length, 16);
    f.sqlite.prepare("UPDATE request_rate_limits SET reset_at = ?").run(Date.now() - 1);
    await f.verify(a.token, "REQUEST");
    const correct = await Promise.all(Array.from({ length: 4 }, () => f.verify(a.token, "CONFIRM", f.codes.at(-1))));
    assert.equal(correct.filter((response) => response.status === 200).length, 1);
    assert.equal(correct.filter((response) => response.status === 400).length, 3);
  } finally { f.close(); }
});

test("issuing codes is separately throttled; company and channel limits do not leak into each other", async () => {
  const f = verificationFixture();
  try {
    const a = await f.seed();
    const b = await f.seed({ companyId: "company-b", partnerId: "partner-b", programId: "program-b" });
    for (let count = 0; count < 5; count++) assert.equal((await f.verify(a.token, "REQUEST")).status, 200);
    assert.equal((await f.verify(a.token, "REQUEST")).status, 429);
    assert.equal(f.codes.length, 5);
    assert.equal((await f.verify(b.token, "REQUEST")).status, 200);
    assert.equal((await f.verify(a.token, "REQUEST", undefined, "WHATSAPP")).status, 200);
    assert.equal((await f.verify(a.token, "CONFIRM", f.codes.at(-1), "WHATSAPP")).status, 200);
    assert.ok(f.sqlite.prepare("SELECT whatsapp_verified_at FROM partner_profiles WHERE partner_id = ?").get(a.partnerId).whatsapp_verified_at);
  } finally { f.close(); }
});

test("expired and malformed codes cannot confirm a contact or evade the attempt budget", async () => {
  const f = verificationFixture();
  try {
    const a = await f.seed();
    await f.verify(a.token, "REQUEST");
    f.sqlite.prepare("UPDATE contact_verification_codes SET expires_at = ?").run(new Date(Date.now() - 1).toISOString());
    assert.equal((await f.verify(a.token, "CONFIRM", f.codes[0])).status, 400);
    for (let count = 0; count < 4; count++) assert.equal((await f.verify(a.token, "CONFIRM", "bad")).status, 400);
    assert.equal((await f.verify(a.token, "REQUEST")).status, 429);
    assert.equal(f.sqlite.prepare("SELECT email_verified_at FROM partner_profiles").get().email_verified_at, null);
  } finally { f.close(); }
});
