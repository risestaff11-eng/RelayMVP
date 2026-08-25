import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mission editor preserves spaces, cursor edits and blank lines until save", async () => {
  const source = await readFile(new URL("../app/dashboard/programs/[id]/program-editor.tsx", import.meta.url), "utf8");
  assert.match(source, /event\.target\.value\.split\("\\n"\)/);
  assert.doesNotMatch(source, /event\.target\.value\.split\("\\n"\)\.map\(\(item\) => item\.trim\(\)\)\.filter\(Boolean\)/);
});

test("mission resources are stored in D1 metadata and exposed through protected downloads", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const companyRoute = await readFile(new URL("../app/api/programs/[id]/missions/[missionId]/files/route.ts", import.meta.url), "utf8");
  const partnerRoute = await readFile(new URL("../app/api/partner/mission-files/[id]/route.ts", import.meta.url), "utf8");
  assert.match(schema, /mission_resources/);
  assert.match(companyRoute, /10 \* 1024 \* 1024/);
  assert.match(partnerRoute, /getPartnerMissionResource/);
});

test("image and engagement submissions do not require client contact details", async () => {
  const route = await readFile(new URL("../app/api/public/submissions/route.ts", import.meta.url), "utf8");
  assert.match(route, /target\.mission\.type === "LEAD" \|\| target\.mission\.type === "DEAL"/);
  assert.match(route, /requiresContact && contactPhone/);
});

test("user-facing application uses the Rela assistant name", async () => {
  const files = [
    "../app/dashboard/programs/new/new-program-form.tsx",
    "../app/dashboard/programs/page.tsx",
    "../app/dashboard/methodologist/methodologist-editor.tsx",
    "../app/dashboard/settings/plan-settings.tsx",
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.match(source, /Rela/);
  assert.doesNotMatch(source, /Gemini/i);
});
