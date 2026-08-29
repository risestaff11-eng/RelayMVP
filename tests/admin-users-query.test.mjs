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
