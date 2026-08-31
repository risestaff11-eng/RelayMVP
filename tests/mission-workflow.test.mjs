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

test("program editor uses guided stages, compact missions and safe drawers", async () => {
  const editor = await readFile(new URL("../app/dashboard/programs/[id]/program-editor.tsx", import.meta.url), "utf8");
  const aiRoute = await readFile(new URL("../app/api/programs/[id]/ai/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(editor, /compact-mission-list/);
  assert.match(editor, /program-drawer/);
  assert.match(editor, /Что увидит агент/);
  assert.match(editor, /Применить задание/);
  assert.match(editor, /moveFormField/);
  assert.match(editor, /window\.confirm\(`Опубликовать программу/);
  assert.match(aiRoute, /variationSeed/);
  assert.match(aiRoute, /existing/);
  assert.match(schema, /submission_form_json/);
});

test("program creation keeps AI optional and draft saves allow incomplete missions", async () => {
  const form = await readFile(new URL("../app/dashboard/programs/new/new-program-form.tsx", import.meta.url), "utf8");
  const createRoute = await readFile(new URL("../app/api/programs/generate/route.ts", import.meta.url), "utf8");
  const updateRoute = await readFile(new URL("../app/api/programs/[id]/route.ts", import.meta.url), "utf8");
  assert.match(form, /Настроить вручную/);
  assert.match(createRoute, /mode === "manual"/);
  assert.match(updateRoute, /publish && \(!title/);
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

test("a new result notifies the company and opens the exact review card", async () => {
  const [route, referralRoute, email, page] = await Promise.all([
    readFile(new URL("../app/api/public/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/referrals/submit/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/agent-email.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/submissions/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /sendCompanyNewSubmissionNotification/);
  assert.match(referralRoute, /sendCompanyNewSubmissionNotification/);
  assert.match(email, /dashboard\/submissions\?submission=/);
  assert.match(email, /Для доступа введите почту и пароль компании/);
  assert.match(page, /initialSelectedId/);
});

test("agent result flow supports confirmed voice drafts and removable multi-file evidence", async () => {
  const form = await readFile(new URL("../app/p/[slug]/missions/[missionId]/submit/lead-submission-form.tsx", import.meta.url), "utf8");
  const transcriptionRoute = await readFile(new URL("../app/api/partner/audio/transcribe/route.ts", import.meta.url), "utf8");
  const submissionRoute = await readFile(new URL("../app/api/public/submissions/route.ts", import.meta.url), "utf8");
  const companyReview = await readFile(new URL("../app/dashboard/submissions/submission-review-list.tsx", import.meta.url), "utf8");
  assert.match(form, /multiple/);
  assert.match(form, /removeFile/);
  assert.match(form, /currentTotal \+ selected\.length > 5/);
  assert.match(form, /voiceDurationSeconds/);
  assert.match(form, /Проверьте результат перед отправкой/);
  assert.match(transcriptionRoute, /generateStructuredJsonFromAudio/);
  assert.match(transcriptionRoute, /Аудиозапись должна быть не длиннее 60 секунд/);
  assert.match(submissionRoute, /audioConfirmed: Boolean\(audioTranscript\)/);
  assert.match(companyReview, /result-audio-player/);
});

test("review step serializes controlled values and edits answers inline", async () => {
  const form = await readFile(new URL("../app/p/[slug]/missions/[missionId]/submit/lead-submission-form.tsx", import.meta.url), "utf8");
  assert.match(form, /form\.set\(fieldName\(field\), String\(value \?\? ""\)\)/);
  assert.match(form, /editingReviewField/);
  assert.match(form, /review-inline-editor/);
  assert.doesNotMatch(form, /onClick=\{\(\) => setStep\(field\.stage === "CONTACT" \? 1 : 2\)\}/);
});

test("agent referrals use isolated tokens and client-origin markers", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const createRoute = await readFile(new URL("../app/api/partner/referrals/route.ts", import.meta.url), "utf8");
  const submitRoute = await readFile(new URL("../app/api/public/referrals/submit/route.ts", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../app/partner/_components/partner-nav.tsx", import.meta.url), "utf8");
  assert.match(schema, /partner_referral_links/);
  assert.match(createRoute, /createPartnerToken/);
  assert.match(createRoute, /partnerReferralLinks/);
  assert.match(submitRoute, /submittedByClient: true/);
  assert.match(submitRoute, /actorType: "CLIENT"/);
  assert.match(navigation, /Реферальная ссылка/);
});

test("legacy public submission route continues inside the agent cabinet", async () => {
  const legacyPage = await readFile(new URL("../app/p/[slug]/missions/[missionId]/submit/page.tsx", import.meta.url), "utf8");
  const partnerPage = await readFile(new URL("../app/partner/[token]/submit/[missionId]/page.tsx", import.meta.url), "utf8");
  assert.match(legacyPage, /redirect\(`\/partner\/\$\{access\}\/submit\/\$\{missionId\}`\)/);
  assert.match(partnerPage, /LeadSubmissionForm/);
});

test("public program entry always submits its program slug", async () => {
  const publicPage = await readFile(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8");
  const partnerEntry = await readFile(new URL("../app/p/[slug]/partner-entry.tsx", import.meta.url), "utf8");
  assert.match(publicPage, /<PartnerEntry programSlug=\{slug\}/);
  assert.match(partnerEntry, /JSON\.stringify\(\{ programSlug, missionId, email/);
});

test("authorized public program puts tasks first and collapses secondary details", async () => {
  const publicPage = await readFile(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8");
  const missionSection = publicPage.indexOf('className="partner-missions-section"');
  const detailsSection = publicPage.indexOf('className="partner-program-details"');
  assert.ok(missionSection > 0);
  assert.ok(detailsSection > missionSection);
  assert.match(publicPage, /<details>/);
  assert.match(publicPage, /Выберите способ заработать/);
  assert.match(publicPage, /Регистрация понадобится только при отправке первой заявки/);
  assert.doesNotMatch(publicPage, /partner-program-hero/);
});

test("user-facing application uses the Yaler assistant name", async () => {
  const files = [
    "../app/dashboard/programs/new/new-program-form.tsx",
    "../app/dashboard/programs/page.tsx",
    "../app/dashboard/methodologist/methodologist-editor.tsx",
    "../app/dashboard/settings/plan-settings.tsx",
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.match(source, /Yaler/);
  assert.doesNotMatch(source, /Gemini/i);
});
