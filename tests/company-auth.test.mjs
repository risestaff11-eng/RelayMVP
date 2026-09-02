import assert from "node:assert/strict";
import test from "node:test";
import { authFixture } from "./helpers/auth-fixture.mjs";

test("old email-first clients always continue to login without account disclosure", async () => {
  const f = authFixture();
  try {
    await f.seed();
    for (const email of ["existing@example.test", "unknown@example.test"]) {
      const response = await f.request("/api/auth/check-email", { email });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { ok: true, exists: true, nextStep: "LOGIN" });
    }
    assert.equal((await f.request("/api/auth/check-email", { email: "invalid" })).status, 400);
    assert.equal((await f.request("/api/auth/check-email", {} , { origin: "https://other.test" })).status, 403);
  } finally { f.close(); }
});

test("existing company login normalizes email and preserves the requested CRM destination", async () => {
  const f = authFixture();
  try {
    await f.seed();
    const response = await f.request("/api/auth/login", { email: " Existing@Example.Test ", password: "ValidPass123", returnTo: "/dashboard/crm?result=123" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).redirectTo, "/dashboard/crm?result=123");
    assert.ok(f.jar.get("relay_session"));
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get().n, 1);
    assert.equal(f.sqlite.prepare("SELECT login_count FROM users").get().login_count, 1);
  } finally { f.close(); }
});

test("unknown, wrong-password and agent-only accounts never register or receive company sessions", async () => {
  const f = authFixture();
  try {
    await f.seed();
    await f.seed("agent@example.test", "active", "AGENT");
    for (const [email, password] of [["existing@example.test", "bad"], ["unknown@example.test", "ValidPass123"], ["agent@example.test", "ValidPass123"]]) {
      const response = await f.request("/api/auth/login", { email, password });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Неверный email или пароль" });
    }
    assert.equal(f.jar.size, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM users").get().n, 2);
    assert.equal(f.deliveries.length, 0);
  } finally { f.close(); }
});

test("duplicate registration points to login and does not overwrite password, profile or roles", async () => {
  const f = authFixture();
  try {
    await f.seed();
    const before = f.sqlite.prepare("SELECT * FROM users").get();
    const response = await f.request("/api/auth/register", { email: "Existing@Example.Test", name: "Different Name", phone: "+77770000000", password: "Different123", acceptedTerms: true, acceptedPrivacy: true });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "ACCOUNT_EXISTS");
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM users").get(), before);
    assert.equal(f.deliveries.length, 0);
  } finally { f.close(); }
});

test("pending registration resumes verification; blocked users stay blocked", async () => {
  const f = authFixture();
  try {
    await f.seed("pending@example.test", "pending");
    await f.seed("blocked@example.test", "blocked");
    const pending = await f.request("/api/auth/login", { email: "pending@example.test", password: "ValidPass123" });
    assert.equal(pending.status, 403);
    assert.equal((await pending.json()).code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(f.deliveries.length, 0);
    assert.equal((await f.request("/api/auth/login", { email: "blocked@example.test", password: "ValidPass123" })).status, 403);
    assert.equal(f.jar.size, 0);
    await f.request("/api/auth/email-verification", { email: "pending@example.test", action: "REQUEST" });
    const verified = await f.request("/api/auth/email-verification", { email: "pending@example.test", action: "CONFIRM", code: f.deliveries[0].code, returnTo: "/dashboard/reports" });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).redirectTo, "/dashboard/reports");
    assert.ok(f.jar.get("relay_session"));
  } finally { f.close(); }
});

test("email-code reset changes password, revokes sessions and permits login without registration", async () => {
  const f = authFixture();
  try {
    await f.seed();
    await f.request("/api/auth/login", { email: "existing@example.test", password: "ValidPass123" });
    assert.equal((await f.request("/api/auth/reset-password", { email: "existing@example.test", action: "REQUEST" })).status, 200);
    const reset = { email: "existing@example.test", action: "CONFIRM", code: f.deliveries[0].code, password: "NewPassword123" };
    assert.equal((await f.request("/api/auth/reset-password", reset)).status, 200);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get().n, 0);
    assert.equal((await f.request("/api/auth/reset-password", reset)).status, 400);
    assert.equal((await f.request("/api/auth/login", { email: reset.email, password: "ValidPass123" })).status, 401);
    assert.equal((await f.request("/api/auth/login", { email: reset.email, password: reset.password })).status, 200);
  } finally { f.close(); }
});

test("company return paths block outside URLs, backslashes and authentication loops", () => {
  const f = authFixture();
  try {
    const { companyReturnTo } = f.load(new URL("../lib/auth-navigation.ts", import.meta.url));
    for (const value of [undefined, "https://other.test", "//other.test", "/\\other.test", "/%5cother.test", "/auth?returnTo=/auth", "/api/auth/logout", "/dashboard/../../auth", "/dashboard\n", "/%E0%A4%A"]) {
      assert.equal(companyReturnTo(value), "/dashboard");
    }
    assert.equal(companyReturnTo("/dashboard/crm?result=1#history"), "/dashboard/crm?result=1#history");
    assert.equal(companyReturnTo("/onboarding"), "/onboarding");
  } finally { f.close(); }
});
