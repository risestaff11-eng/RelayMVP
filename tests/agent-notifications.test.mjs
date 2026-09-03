import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

async function createSubmission(f, agent, phone = "+77012223344") {
  const response = await f.request("/api/public/submissions", f.form(agent, { "field__contact-phone": phone }));
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  return result.submissionId;
}
const review = (f, id, payload) => f.request(`/api/submissions/${id}`, payload, { method: "PATCH", route: "/api/submissions/[id]", params: { id } });
const payment = (f, id, paid) => f.request(`/api/rewards/${id}`, { paid }, { method: "PATCH", route: "/api/rewards/[id]", params: { id } });
const messages = (f) => f.deliveries.filter((message) => message.type === "work-update");

test("status and reward changes notify the correct agent; repeated saves send no duplicate email", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    const id = await createSubmission(f, a);
    f.setCompany("company-a");
    const active = { reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS" };
    assert.equal((await review(f, id, active)).status, 200);
    assert.equal(messages(f).length, 1);
    assert.equal(messages(f)[0].destination, a.email);
    assert.ok(messages(f)[0].updates[0].includes("Клиент в работе"));
    assert.equal((await review(f, id, active)).status, 200);
    assert.equal(messages(f).length, 1);
    assert.equal((await review(f, id, { ...active, salesStatus: "WON", dealAmount: 500000 })).status, 200);
    assert.ok(messages(f)[1].updates[0].includes("Вознаграждение одобрено, ожидает выплаты · 25 000 ₸"));
    const reward = f.sqlite.prepare("SELECT * FROM rewards WHERE submission_id = ?").get(id);
    assert.equal((await payment(f, reward.id, true)).status, 200);
    assert.ok(messages(f)[2].updates[0].includes("Компания отметила перевод"));
    assert.equal((await payment(f, reward.id, true)).status, 200);
    assert.equal(messages(f).length, 3);
    assert.ok(!JSON.stringify(messages(f)).includes(a.token));
    assert.ok(!JSON.stringify(messages(f)).includes("77012223344"));
    const portal = await f.load(new URL("../db/partner.ts", import.meta.url)).getPartnerPortal(a.token);
    assert.equal(portal.rewards[0].amount, 25000);
    assert.equal(portal.rewards[0].status, "PAID");
    f.setCompany("company-b");
    assert.equal((await review(f, id, active)).status, 404);
    assert.equal((await payment(f, reward.id, false)).status, 404);
    await f.load(new URL("../lib/agent-work-notifications.ts", import.meta.url)).notifyAgentWorkChanges("company-b", [id]);
    assert.equal(messages(f).length, 3);
  } finally { f.close(); }
});

test("bulk payouts combine programs into one email per agent; notification failure does not roll back payment", async () => {
  const f = agentFixture();
  const originalError = console.error;
  try {
    const a = await f.seed();
    const second = await f.seed({ programId: "program-second", partnerId: "partner-second" });
    const ids = [await createSubmission(f, a), await createSubmission(f, second, "+77015556677")];
    f.setCompany("company-a");
    for (const id of ids) assert.equal((await review(f, id, { reviewStatus: "ACCEPTED", salesStatus: "WON", dealAmount: 100000 })).status, 200);
    f.deliveries.length = 0;
    const bulk = (paid) => f.request(`/api/agents/${a.partnerId}/paid`, { paid }, { method: "PATCH", route: "/api/agents/[id]/paid", params: { id: a.partnerId } });
    assert.equal((await bulk(true)).status, 200);
    assert.equal(messages(f).length, 1);
    assert.equal(messages(f)[0].updates.length, 2);
    assert.equal((await bulk(true)).status, 200);
    assert.equal(messages(f).length, 1);
    f.load(new URL("../lib/agent-email.ts", import.meta.url)).sendAgentWorkUpdate = async () => { throw new Error("Simulated provider error"); };
    const logs = [];
    console.error = (message) => logs.push(message);
    assert.equal((await bulk(false)).status, 200);
    assert.ok(f.sqlite.prepare("SELECT status FROM rewards").all().every((reward) => reward.status === "APPROVED"));
    assert.equal(logs.length, 1);
  } finally { console.error = originalError; f.close(); }
});

test("notification template escapes content and links to email login, not a permanent token", async () => {
  const fetch = globalThis.fetch;
  try {
    let sent;
    globalThis.fetch = async (url, options) => { assert.equal(url, "https://api.resend.com/emails"); sent = JSON.parse(options.body); assert.ok(options.signal); return new Response("{}"); };
    const mail = typescriptLoader({ "cloudflare:workers": { env: { RESEND_API_KEY: "test-only", MAGIC_FROM_EMAIL: "no-reply@example.test" } } })(new URL("../lib/agent-email.ts", import.meta.url));
    await mail.sendAgentWorkUpdate({ destination: "agent@example.test", companyName: "<script>company</script>", updates: ["<img onerror=alert(1)>"] });
    assert.deepEqual(sent.to, ["agent@example.test"]);
    assert.ok(!sent.html.includes("<script>"));
    assert.ok(!sent.html.includes("<img"));
    assert.ok(sent.html.includes("https://agents.risestaff.kz/agent-login"));
    assert.ok(sent.html.includes("&lt;img"));
  } finally { globalThis.fetch = fetch; }
});
