import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

test("real submission saves dynamic answers, voice evidence, files, history and company notification", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    f.sqlite.prepare("UPDATE programs SET submission_form_json = ? WHERE id = ?").run(JSON.stringify([
      { id: "course", label: "Course", type: "TEXT", semantic: "CUSTOM", required: true },
    ]), a.programId);
    const form = f.form(a, { "field__course": "Mathematics", "field__partner-comment": "Ready for trial", audioTranscript: "Interested in mathematics", audioDurationSeconds: "12" });
    form.set("file__files", new File(["proof"], "proof.pdf", { type: "application/pdf" }));
    form.set("voiceNote", new File(["audio"], "voice.webm", { type: "audio/webm" }));
    const response = await f.request("/api/public/submissions", form);
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    const saved = f.sqlite.prepare("SELECT * FROM submissions WHERE id = ?").get(result.submissionId);
    assert.equal(saved.partner_id, a.partnerId);
    assert.equal(saved.company_id, a.companyId);
    assert.equal(saved.program_id, a.programId);
    assert.equal(saved.contact_phone, "77012223344");
    assert.equal(saved.review_status, "PENDING");
    assert.equal(saved.sales_status, "NONE");
    const payload = JSON.parse(saved.payload_json);
    assert.equal(payload.customAnswers[0].value, "Mathematics");
    assert.equal(payload.audioConfirmed, true);
    assert.equal(payload.audioTranscript, "Interested in mathematics");
    assert.equal(f.objects.size, 2);
    assert.ok([...f.objects.keys()].every((key) => key.startsWith(`${a.companyId}/${saved.id}/`)));
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submission_attachments").get().n, 2);
    assert.equal(f.sqlite.prepare("SELECT actor_type FROM submission_status_events").get().actor_type, "PARTNER");
    assert.equal(f.deliveries[0].submissionId, saved.id);
    assert.equal(f.deliveries[0].destination, "company-a-owner@example.test");
    const portal = await f.load(new URL("../db/partner.ts", import.meta.url)).getPartnerPortal(a.token);
    assert.equal(portal.submissions[0].id, saved.id);
  } finally { f.close(); }
});

test("referral tokens stay separate from portal tokens; duplicates are blocked only within the company", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    const b = await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    const contact = { name: "Client", contact: "+77012223344", comment: "Trial lesson" };
    const request = (referralToken) => f.request("/api/public/referrals/submit", { ...contact, referralToken });
    assert.equal((await request(a.token)).status, 404);
    assert.equal((await request(a.referralToken)).status, 201);
    assert.equal((await request(a.referralToken)).status, 409);
    assert.equal((await request(b.referralToken)).status, 201);
    const rows = f.sqlite.prepare("SELECT * FROM submissions ORDER BY company_id").all();
    assert.deepEqual(rows.map((row) => row.company_id), [a.companyId, b.companyId]);
    assert.equal(JSON.parse(rows[0].payload_json).submittedByClient, true);
    assert.equal(JSON.parse(rows[0].payload_json).referralSource, "CLIENT_SELF_SERVICE");
    assert.ok(f.sqlite.prepare("SELECT actor_type FROM submission_status_events").all().every((row) => row.actor_type === "CLIENT"));
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 409);
    assert.equal(f.deliveries.length, 2);
  } finally { f.close(); }
});

test("submission cannot escape tenant, acceptance, program or mission access restrictions", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    const b = await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    assert.equal((await f.request("/api/public/submissions", f.form(a, { programSlug: b.programId, missionId: b.missionId }))).status, 401);
    f.sqlite.prepare("UPDATE partner_mission_acceptances SET status = 'CANCELLED' WHERE partner_id = ?").run(a.partnerId);
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 400);
    f.sqlite.prepare("UPDATE programs SET status = 'PAUSED' WHERE id = ?").run(a.programId);
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 401);
    f.sqlite.prepare("UPDATE programs SET status = 'ACTIVE' WHERE id = ?").run(a.programId);
    f.sqlite.prepare("UPDATE missions SET status = 'PAUSED' WHERE id = ?").run(a.missionId);
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 404);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
  } finally { f.close(); }
});

test("IMAGE and ENGAGEMENT missions need no client contact but commercial missions validate it", async () => {
  for (const type of ["IMAGE", "ENGAGEMENT", "LEAD", "DEAL"]) {
    const f = agentFixture();
    try {
      const a = await f.seed({ type });
      const response = await f.request("/api/public/submissions", f.form(a, { "field__contact-phone": "" }));
      assert.equal(response.status, ["LEAD", "DEAL"].includes(type) ? 400 : 201, type);
    } finally { f.close(); }
  }
});

test("submission rejects invalid links, missing required values and more than five attachments before upload", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    for (const values of [{ "field__contact-name": "" }, { "field__external-links": "javascript:alert(1)" }, { "field__contact-email": "not-email" }]) {
      assert.equal((await f.request("/api/public/submissions", f.form(a, values))).status, 400);
    }
    const form = f.form(a);
    for (let file = 0; file < 6; file++) form.append("file__files", new File(["proof"], `${file}.pdf`, { type: "application/pdf" }));
    assert.equal((await f.request("/api/public/submissions", form)).status, 400);
    assert.equal(f.objects.size, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
  } finally { f.close(); }
});
