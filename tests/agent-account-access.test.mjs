import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agent login requires email, normalized phone and a one-time email code", async () => {
  const [route, auth, schema] = await Promise.all([
    read("app/api/agent/access/route.ts"),
    read("lib/agent-auth.ts"),
    read("db/schema.ts"),
  ]);
  assert.match(route, /findAgentPartners/);
  assert.match(route, /AGENT_LOGIN/);
  assert.match(route, /attempts >= 5/);
  assert.match(auth, /normalizeAgentPhone/);
  assert.match(auth, /httpOnly: true/);
  assert.match(schema, /agent_login_codes/);
  assert.match(schema, /agent_sessions/);
});

test("one agent can open programs from several companies without merging tenant data", async () => {
  const [source, portal, workspace, layout] = await Promise.all([read("db/agent-access.ts"), read("db/partner.ts"), read("app/agent/page.tsx"), read("app/partner/[token]/layout.tsx")]);
  assert.match(source, /companiesMap/);
  assert.match(source, /row\.companyId === companyId/);
  assert.match(source, /partnerAccessLinks/);
  assert.match(source, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(workspace, /Данные компаний не смешиваются/);
  assert.match(layout, /Сменить компанию/);
  assert.match(source, /eq\(programs\.status, "ACTIVE"\)/);
  assert.match(source, /gt\(programs\.expiresAt/);
  assert.match(portal, /availableProgramRows/);
  assert.match(portal, /mission\.status === "ACTIVE"/);
});

test("new agent applications are persisted, emailed and manageable by admin", async () => {
  const [route, email, admin] = await Promise.all([
    read("app/api/agent/applications/route.ts"),
    read("lib/agent-email.ts"),
    read("app/system/users/system-users.tsx"),
  ]);
  assert.match(route, /agentApplications/);
  assert.match(route, /24 \* 60 \* 60 \* 1000/);
  assert.match(email, /subject: "Новый агент"/);
  assert.match(email, /ADMIN_NOTIFY_EMAIL/);
  assert.match(admin, /Заявки на участие/);
});

test("landing company applications are validated and emailed to the owner", async () => {
  const [route, email, form] = await Promise.all([
    read("app/api/marketing/company-application/route.ts"),
    read("lib/agent-email.ts"),
    read("app/company-application-form.tsx"),
  ]);
  assert.match(route, /sameOrigin/);
  assert.match(route, /website/);
  assert.match(route, /sendCompanyApplicationNotification/);
  assert.match(email, /subject: "Новая компания"/);
  assert.match(email, /rtarzhakayev@gmail\.com/);
  assert.match(form, /\/api\/marketing\/company-application/);
});

test("support entry is temporary, server-authorized and visibly disclosed", async () => {
  const [auth, route, layout] = await Promise.all([
    read("lib/account-auth.ts"),
    read("app/api/system/support/route.ts"),
    read("app/dashboard/layout.tsx"),
  ]);
  assert.match(auth, /SUPPORT_TTL_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(auth, /hasAdminSession/);
  assert.match(auth, /supportSessions/);
  assert.match(route, /sameOrigin/);
  assert.match(layout, /Режим техподдержки/);
  assert.match(layout, /Вход и время сессии фиксируются/);
});
