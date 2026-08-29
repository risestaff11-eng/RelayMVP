import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("company users can reset a forgotten password with registration phone", async () => {
  const route = await readFile(new URL("../app/api/auth/reset-password/route.ts", import.meta.url), "utf8");
  const flow = await readFile(new URL("../app/auth/auth-flow.tsx", import.meta.url), "utf8");
  assert.match(route, /normalizePhone/);
  assert.match(route, /hashPassword\(password\)/);
  assert.match(route, /delete\(authSessions\)/);
  assert.match(route, /recent\.length >= 5/);
  assert.match(flow, /Забыли пароль\?/);
  assert.match(flow, /\/api\/auth\/reset-password/);
  assert.match(flow, /Не помню телефон — написать в WhatsApp/);
});

test("registration success explains activation and password recovery without promising email", async () => {
  const flow = await readFile(new URL("../app/auth/auth-flow.tsx", import.meta.url), "utf8");
  assert.match(flow, /Письмо после регистрации не отправляется/);
  assert.match(flow, /можно восстановить по email и телефону/);
});
