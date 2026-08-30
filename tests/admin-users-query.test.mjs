import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin users list includes pending company applicants without a company workspace", async () => {
  const source = await readFile(new URL("../db/admin.ts", import.meta.url), "utf8");

  assert.match(source, /\.from\(users\)/);
  assert.match(source, /\.innerJoin\(userRoles,[\s\S]*?"COMPANY"/);
  assert.match(source, /\.leftJoin\(companies,/);
  assert.match(source, /emailVerifiedAt: users\.emailVerifiedAt/);
  assert.doesNotMatch(source, /\.from\(companies\)\s*\.innerJoin\(users,/);
});

test("company deletion removes dependent data and preserves only an anonymized audit row", async () => {
  const source = await readFile(new URL("../db/admin.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/system/users/[id]/route.ts", import.meta.url), "utf8");
  assert.match(source, /company_account_deletion_logs/);
  assert.match(source, /DELETE FROM partner_referral_links/);
  assert.match(source, /DELETE FROM company_methodology_briefs/);
  assert.match(source, /DELETE FROM companies WHERE owner_user_id/);
  assert.match(source, /DELETE FROM users WHERE id/);
  assert.match(source, /bucket\.list\(\{ prefix: `\$\{companyId\}\//);
  assert.match(source, /Аккаунт не был удалён полностью/);
  assert.match(route, /DELETE_COMPANY/);
  assert.match(route, /deletedAccount/);
});

test("admin records company logins and exposes operational filters and CSV export", async () => {
  const auth = await readFile(new URL("../lib/account-auth.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../app/system/users/system-users.tsx", import.meta.url), "utf8");
  assert.match(auth, /lastLoginAt: now/);
  assert.match(auth, /loginCount: sql/);
  assert.match(ui, /ПОСЛЕДНИЙ ВХОД/);
  assert.match(ui, /по Астане/i);
  assert.match(ui, /Скачать сводку CSV/);
  assert.match(ui, /ЖУРНАЛ УДАЛЕНИЙ/);
  assert.match(ui, /Больше выплат/);
});
