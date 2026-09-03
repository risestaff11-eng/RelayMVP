import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

test("login matches normalized email and phone, then requires a one-time email code", async () => {
  const f = agentFixture();
  try {
    await f.seed();
    const credentials = { email: " AGENT@EXAMPLE.TEST ", phone: "8 (777) 123-45-67" };
    const request = (action, extra = {}) => f.request("/api/agent/access", { ...credentials, action, ...extra });
    assert.equal((await request("REQUEST", { phone: "+77010000000" })).status, 200);
    assert.equal(f.deliveries.length, 0);
    assert.equal((await request("REQUEST")).status, 200);
    assert.equal(f.jar.size, 0);
    const code = f.deliveries[0].code;
    assert.equal(f.sqlite.prepare("SELECT code_hash FROM agent_login_codes").get().code_hash.length, 64);
    const response = await request("VERIFY", { code });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).redirect, "/agent");
    const cookie = f.jar.get("risestaff_agent_session");
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    const auth = f.load(new URL("../lib/agent-auth.ts", import.meta.url));
    assert.equal((await auth.getAgentSession()).email, "agent@example.test");
    assert.equal((await request("VERIFY", { code })).status, 400);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM agent_sessions").get().n, 1);
    await auth.clearAgentSession();
    assert.equal(await auth.getAgentSession(), null);
  } finally { f.close(); }
});

test("five incorrect login codes exhaust the attempt limit; expired codes cannot open a session", async () => {
  const f = agentFixture();
  try {
    const agent = await f.seed();
    const request = (action, code) => f.request("/api/agent/access", { email: agent.email, phone: agent.phone, action, code });
    await request("REQUEST");
    const code = f.deliveries[0].code;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await request("VERIFY", wrong)).status, 400);
    assert.equal(f.sqlite.prepare("SELECT attempts FROM agent_login_codes").get().attempts, 5);
    assert.equal((await request("VERIFY", code)).status, 400);
    f.sqlite.prepare("UPDATE agent_login_codes SET attempts = 0, expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    assert.equal((await request("VERIFY", code)).status, 400);
    assert.equal(f.jar.size, 0);
    for (let count = 1; count < 5; count++) assert.equal((await request("REQUEST")).status, 200);
    assert.equal((await request("REQUEST")).status, 429);
    assert.equal(f.deliveries.length, 5);
  } finally { f.close(); }
});

test("company selection keeps historical memberships while only active programs permit new work", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    await f.seed({ companyId: "company-b", programId: "program-b", partnerId: "partner-b" });
    await f.seed({ programId: "paused", partnerId: "paused-agent", status: "PAUSED" });
    await f.seed({ programId: "archived", partnerId: "archived-agent", status: "ARCHIVED" });
    await f.seed({ programId: "expired", partnerId: "expired-agent", expiresAt: new Date(Date.now() - 1000).toISOString() });
    const access = f.load(new URL("../db/agent-access.ts", import.meta.url));
    const workspace = await access.getAgentWorkspace(a.email, a.phone);
    assert.deepEqual(workspace.companies.map((company) => [company.id, company.programs.map((program) => program.id)]), [
      ["company-a", ["archived", "expired", "paused", "program-a"]], ["company-b", ["program-b"]],
    ]);
    assert.equal(await access.createCompanyAccessForAgent(a.email, a.phone, "unrelated-company"), null);
    const token = await access.createCompanyAccessForAgent(a.email, a.phone, "company-a");
    assert.ok(token);
    const portal = await f.load(new URL("../db/partner.ts", import.meta.url)).getPartnerPortal(token);
    assert.equal(portal.company.id, "company-a");
    assert.deepEqual(portal.programs.map((program) => program.id), ["program-a"]);
    assert.deepEqual(portal.missions.map((mission) => mission.programId), ["program-a"]);
    assert.ok(Date.parse(portal.accessExpiresAt) > Date.now() + 29 * 86400000);
  } finally { f.close(); }
});

test("expired and blocked access tokens expose no portal data", async () => {
  const f = agentFixture();
  try {
    const a = await f.seed();
    const { getPartnerPortal } = f.load(new URL("../db/partner.ts", import.meta.url));
    assert.equal(await getPartnerPortal("invalid-token"), null);
    f.sqlite.prepare("UPDATE partner_access_links SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    assert.equal(await getPartnerPortal(a.token), null);
    f.sqlite.prepare("UPDATE partner_access_links SET expires_at = ?").run(a.accessExpiresAt);
    f.sqlite.prepare("UPDATE partners SET status = 'BLOCKED'").run();
    assert.equal(await getPartnerPortal(a.token), null);
  } finally { f.close(); }
});

test("agent application validates consent and persists only one application per day", async () => {
  const f = agentFixture();
  try {
    const payload = { name: "Applicant", email: "applicant@example.test", phone: "+77012223344", city: "Astana", industries: ["Education"], network: "Parents", acceptedTerms: true };
    assert.equal((await f.request("/api/agent/applications", { ...payload, acceptedTerms: false })).status, 400);
    assert.equal((await f.request("/api/agent/applications", payload)).status, 201);
    assert.equal((await f.request("/api/agent/applications", payload)).status, 200);
    assert.equal(f.deliveries.filter((item) => item.type === "application").length, 1);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM agent_applications").get().n, 1);
    assert.equal((await f.request("/api/agent/applications", payload, { headers: { origin: "https://evil.test" } })).status, 403);
  } finally { f.close(); }
});
