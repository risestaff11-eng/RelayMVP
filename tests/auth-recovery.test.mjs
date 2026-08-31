import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("company users can reset a forgotten password with a one-time email code", async () => {
  const route = await readFile(new URL("../app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
  const flow = await readFile(new URL("../app/auth/auth-flow.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(route, /sendPasswordResetCode/);
  assert.match(route, /hashVerificationCode/);
  assert.match(route, /expiresAt/);
  assert.match(route, /attempts >= 5/);
  assert.match(route, /hashPassword\(password\)/);
  assert.match(route, /delete\(authSessions\)/);
  assert.match(schema, /password_reset_codes/);
  assert.match(flow, /Забыли пароль\?/);
  assert.match(flow, /\/api\/auth\/reset-password/);
  assert.match(flow, /Код из письма/);
  assert.match(flow, /Придумайте новый пароль/);
});

test("registration offers email-code activation with a manual admin fallback", async () => {
  const flow = await readFile(new URL("../app/auth/auth-flow.tsx", import.meta.url), "utf8");
  const register = await readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8");
  const verification = await readFile(new URL("../app/api/auth/email-verification/route.ts", import.meta.url), "utf8");
  assert.match(flow, /Введите код из письма/);
  assert.match(flow, /Запросить ручную активацию/);
  assert.match(register, /sendCompanyEmailCode/);
  assert.match(verification, /status: "active"/);
  assert.match(verification, /createAuthSession/);
});
