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
  const form = await readFile(new URL("../lib/submission-form.ts", import.meta.url), "utf8");
  assert.match(route, /visibleSubmissionFormFields/);
  assert.match(form, /NON_COMMERCIAL/);
  assert.match(form, /missionType === "LEAD" \|\| missionType === "DEAL"/);
});

test("program editor supports unique AI variants, configurable form fields and publish confirmation", async () => {
  const editor = await readFile(new URL("../app/dashboard/programs/[id]/program-editor.tsx", import.meta.url), "utf8");
  const aiRoute = await readFile(new URL("../app/api/programs/[id]/ai/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(editor, /Новый вариант с Rela/);
  assert.match(editor, /ШАГ 4/);
  assert.match(editor, /moveFormField/);
  assert.match(editor, /window\.confirm\(`Опубликовать программу/);
  assert.match(aiRoute, /variationSeed/);
  assert.match(aiRoute, /existing/);
  assert.match(schema, /submission_form_json/);
});

test("public submission saves dynamic answers and files", async () => {
  const route = await readFile(new URL("../app/api/public/submissions/route.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/p/[slug]/missions/[missionId]/submit/lead-submission-form.tsx", import.meta.url), "utf8");
  assert.match(route, /field__/);
  assert.match(route, /file__/);
  assert.match(route, /customAnswers/);
  assert.match(form, /formFields/);
  assert.match(form, /reportValidity/);
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
