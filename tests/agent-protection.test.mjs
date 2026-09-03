import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

test("self-referral comparison normalizes phones and email without treating empty contacts as matches", () => {
  const { isSelfReferral } = typescriptLoader()(new URL("../lib/submission-antifraud.ts", import.meta.url));
  const self = [{ email: "Agent@Example.Test ", phone: "+7 (777) 123-45-67" }];
  for (const phone of ["87771234567", "7771234567", "+7 777 123 45 67"]) assert.equal(isSelfReferral({ phone }, self), true);
  assert.equal(isSelfReferral({ email: " agent@example.test" }, self), true);
  assert.equal(isSelfReferral({}, [{ email: "", phone: "" }]), false);
  assert.equal(isSelfReferral({ phone: "+77012223344" }, self), false);
});

test("both real intake handlers reject self referrals and bots before saving records or files", async () => {
  const f = agentFixture();
  try {
    const identity = await f.seed();
    for (const fields of [{ "field__contact-phone": "87771234567" }, { "field__contact-email": "AGENT@example.test" }]) {
      const response = await f.request("/api/public/submissions", f.form(identity, fields));
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "SELF_REFERRAL");
    }
    for (const contact of ["agent@example.test", "8 (777) 123-45-67"]) {
      assert.equal((await f.request("/api/public/referrals/submit", { referralToken: identity.referralToken, name: "Self", contact })).status, 422);
    }
    assert.equal((await f.request("/api/public/referrals/submit", { website_url: "https://spam.test" })).status, 400);
    assert.equal((await f.request("/api/public/submissions", f.form(identity, { website_url: "https://spam.test" }))).status, 400);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
    assert.equal(f.objects.size, 0);
    assert.equal(f.deliveries.length, 0);
  } finally { f.close(); }
});

test("common hash comparison accepts only exact matches including first/last character mismatches", () => {
  const { timingSafeEqual } = typescriptLoader()(new URL("../lib/secure-compare.ts", import.meta.url));
  assert.equal(timingSafeEqual("a".repeat(64), "a".repeat(64)), true);
  assert.equal(timingSafeEqual("b" + "a".repeat(63), "a".repeat(64)), false);
  assert.equal(timingSafeEqual("a".repeat(63) + "b", "a".repeat(64)), false);
  assert.equal(timingSafeEqual("a", "aa"), false);
});

test("route inventory rejects any new unclassified public top-level page", async () => {
  const routing = typescriptLoader()(new URL("../lib/domain-routing.ts", import.meta.url));
  const roots = new Set([...routing.AGENT_ROUTE_ROOTS, ...routing.COMPANY_ROUTE_ROOTS, ...routing.MARKETING_ROUTE_ROOTS]);
  const entries = await readdir(new URL("../app/", import.meta.url), { withFileTypes: true });
  async function hasPage(url) {
    const entries = await readdir(url, { withFileTypes: true });
    if (entries.some((entry) => /^page\.(tsx|ts|jsx|js)$/.test(entry.name))) return true;
    for (const entry of entries.filter((entry) => entry.isDirectory())) if (await hasPage(new URL(`${entry.name}/`, url))) return true;
    return false;
  }
  for (const entry of entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "api")) {
    if (await hasPage(new URL(`../app/${entry.name}/`, import.meta.url))) assert.ok(roots.has(entry.name), `Classify app/${entry.name} in lib/domain-routing.ts before publishing`);
  }
  for (const root of routing.AGENT_ROUTE_ROOTS) {
    assert.equal(routing.canonicalRedirectFor(`https://risestaff.kz/${root}/test`).origin, "https://agents.risestaff.kz");
  }
  assert.equal(routing.canonicalRedirectFor("https://risestaff.kz/partnership"), null);
});
