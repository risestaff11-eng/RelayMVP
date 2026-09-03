import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

const emailModule = new URL("../lib/agent-email.ts", import.meta.url);
const noticeModule = new URL("../lib/company-submission-notifications.ts", import.meta.url);
const mailRuntime = { RESEND_API_KEY: "test-only", MAGIC_FROM_EMAIL: "RiseStaff <sender@example.test>" };
const example = { destination: "owner@example.test", companyName: "School", agentName: "Ambassador", missionTitle: "Recommend a course", programName: "Courses", contactName: "Student", contactCompany: "", submissionId: "lead-1", type: "LEAD" };

test("both lead entry points send the real email to their saved company owner after commit, never to form recipients", async () => {
  const f = agentFixture({ captureSubmissionEmail: false });
  const originalFetch = globalThis.fetch;
  try {
    Object.assign(f.runtime, mailRuntime);
    const a = await f.seed();
    const b = await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    const sent = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      const id = options.headers["Idempotency-Key"].split("/")[1];
      assert.ok(f.sqlite.prepare("SELECT id FROM submissions WHERE id = ?").get(id));
      assert.ok(f.sqlite.prepare("SELECT id FROM submission_status_events WHERE submission_id = ?").get(id));
      sent.push(JSON.parse(options.body));
      return Response.json({ id: `email-${sent.length}` });
    };
    const form = f.form(a, { destination: "attacker@example.test", companyId: b.companyId });
    const response = await f.request("/api/public/submissions", form);
    assert.equal(response.status, 201);
    const { submissionId } = await response.json();
    assert.deepEqual(sent[0].to, ["company-a-owner@example.test"]);
    assert.equal(sent[0].subject, "Новый лид от агента · program-a");
    assert.ok(sent[0].html.includes("Ambassador"));
    const authLink = new URL(sent[0].text.match(/https:\/\/company\.risestaff\.kz\/auth\?\S+/)[0]);
    assert.equal(authLink.searchParams.get("returnTo"), `/dashboard/crm?submission=${submissionId}`);
    assert.ok(!sent[0].text.includes(a.token));
    assert.ok(!sent[0].text.includes("attacker@example.test"));
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 409);
    assert.equal(sent.length, 1);
    assert.equal((await f.request("/api/public/referrals/submit", { referralToken: b.referralToken, name: "Student B", contact: "+77012223344", destination: "attacker@example.test" })).status, 201);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1].to, ["company-b-owner@example.test"]);
    assert.ok(sent[1].html.includes("Student B"));
    assert.ok(sent[1].html.includes("program-b"));
  } finally { globalThis.fetch = originalFetch; f.close(); }
});

test("notification lookup enforces company, program and ambassador relations", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    const b = await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    const { submissionId } = await (await f.request("/api/public/submissions", f.form(a))).json();
    const notify = f.load(noticeModule).notifyCompanyNewSubmission;
    await notify(b.companyId, submissionId);
    await notify(a.companyId, "missing");
    assert.equal(f.deliveries.length, 1);
    f.sqlite.prepare("UPDATE submissions SET partner_id = ? WHERE id = ?").run(b.partnerId, submissionId);
    await notify(a.companyId, submissionId);
    assert.equal(f.deliveries.length, 1);
  } finally { f.close(); }
});

test("mail and recipient lookup failures cannot turn a saved lead into a failed submission", async (context) => {
  context.mock.method(console, "error", () => {});
  for (const failure of ["send", "lookup"]) {
    const f = agentFixture();
    try {
      const a = await f.seed();
      if (failure === "send") f.load(emailModule).sendCompanyNewSubmissionNotification = async () => { throw new Error("Provider unavailable"); };
      else {
        const prepare = f.binding.prepare;
        f.binding.prepare = (query) => { if (query.startsWith("SELECT u.email")) throw new Error("Temporary lookup error"); return prepare(query); };
      }
      assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 201, failure);
      assert.equal((await f.request("/api/public/referrals/submit", { referralToken: a.referralToken, name: "Client B", contact: "+77012223345" })).status, 201, failure);
      assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 2);
      assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submission_status_events").get().n, 2);
    } finally { f.close(); }
  }
});

test("email has safe HTML, plain text and a login link; non-lead results keep their correct label", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const sent = [];
    globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return Response.json({ id: "test" }); };
    const send = typescriptLoader({ "cloudflare:workers": { env: mailRuntime } })(emailModule).sendCompanyNewSubmissionNotification;
    await send({ ...example, contactName: '<img src=x onerror="alert(1)">', programName: "Courses\r\nBcc: test", submissionId: "lead&other=1" });
    assert.ok(!sent[0].html.includes("<img"));
    assert.ok(sent[0].html.includes("&lt;img"));
    assert.ok(!/[\r\n]/.test(sent[0].subject));
    assert.equal(new URL(sent[0].text.match(/https:\/\/company\.risestaff\.kz\/auth\?\S+/)[0]).searchParams.get("returnTo"), "/dashboard/crm?submission=lead%26other%3D1");
    await send({ ...example, type: "IMAGE" });
    assert.ok(sent[1].subject.startsWith("Новый результат от агента"));
  } finally { globalThis.fetch = originalFetch; }
});

test("transient mail failures retry once with exactly the same body and idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const send = typescriptLoader({ "cloudflare:workers": { env: mailRuntime } })(emailModule).sendCompanyNewSubmissionNotification;
    for (const failure of ["network", "timeout", 503, 429]) {
      const requests = [];
      globalThis.fetch = async (_url, options) => {
        requests.push(options);
        if (requests.length > 1) return Response.json({ id: "test" });
        if (typeof failure === "string") throw new DOMException("Temporary failure", failure === "timeout" ? "TimeoutError" : "NetworkError");
        return new Response(null, { status: failure, headers: { "retry-after": "0" } });
      };
      await send(example);
      assert.equal(requests.length, 2);
      assert.equal(requests[0].headers["Idempotency-Key"], "company-new-submission/lead-1");
      assert.equal(requests[0].body, requests[1].body);
      assert.deepEqual(requests[0].headers, requests[1].headers);
      assert.ok(requests.every((request) => request.signal instanceof AbortSignal));
      assert.notEqual(requests[0].signal, requests[1].signal);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("permanent provider failures and long retry windows do not trigger immediate resend", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const send = typescriptLoader({ "cloudflare:workers": { env: mailRuntime } })(emailModule).sendCompanyNewSubmissionNotification;
    for (const status of [400, 401, 403, 409, 422, 429]) {
      let requests = 0;
      globalThis.fetch = async () => { requests++; return new Response(null, { status, headers: { "retry-after": "30" } }); };
      await assert.rejects(() => send(example));
      assert.equal(requests, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("an exhausted retry or missing mail configuration is observable without undoing a lead", async (context) => {
  context.mock.method(console, "error", () => {});
  const originalFetch = globalThis.fetch;
  const f = agentFixture({ captureSubmissionEmail: false });
  try {
    const a = await f.seed();
    let requests = 0;
    globalThis.fetch = async () => { requests++; return new Response(null, { status: 503 }); };
    assert.equal((await f.request("/api/public/submissions", f.form(a))).status, 201);
    assert.equal(requests, 0); // Missing configuration does not attempt delivery.
    Object.assign(f.runtime, mailRuntime);
    assert.equal((await f.request("/api/public/referrals/submit", { referralToken: a.referralToken, name: "Client B", contact: "+77012223345" })).status, 201);
    assert.equal(requests, 2);
    assert.equal(console.error.mock.callCount(), 2);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 2);
  } finally { globalThis.fetch = originalFetch; f.close(); }
});
