import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

test("CRM pages stay bounded; totals/search cover all clients and tenant boundaries are enforced", async () => {
  const f = agentFixture(); try {
    const a = await f.seed(); f.setCompany(a.companyId);
    for (let i = 0; i < 145; i++) await f.db.insert(f.schema.submissions).values({ id: `lead-${String(i).padStart(3, "0")}`, companyId: a.companyId, programId: a.programId, missionId: a.missionId, partnerId: a.partnerId, type: "LEAD", contactName: `Client ${i}`, estimatedDealAmount: 1000, createdAt: "2026-09-12T00:00:00Z" });
    const { crmBoard } = f.load(new URL("../db/crm-board.ts", import.meta.url));
    const company = { id: a.companyId, crmAverageCheck: 5000, crmGoalCurrency: "KZT" };
    const first = await crmBoard(company);
    assert.equal(first.items.length, 20);
    assert.equal(first.totals[0].count, 145);
    assert.equal(first.potential, 145000);
    const last = first.items.at(-1);
    const second = await crmBoard(company, { stage: "NEW", cursorDate: last.createdAt, cursorId: last.id });
    assert.equal(second.items.length, 20);
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 40);
    const found = await crmBoard(company, { q: "Client 3" });
    assert.equal(found.totals[0].count, 11);
    const { getSubmissionsForCompany } = f.load(new URL("../db/programs.ts", import.meta.url));
    const read = f.binding.prepare.bind(f.binding);
    f.binding.prepare = (query) => { const statement = read(query); const bind = statement.bind.bind(statement); statement.bind = (...args) => { assert.ok(args.length <= 100, "D1 bind parameter budget"); return bind(...args); }; return statement; };
    assert.equal((await getSubmissionsForCompany(a.companyId, { ids: Array.from({ length: 145 }, (_, i) => `lead-${String(i).padStart(3, "0")}`) })).length, 145);
    const other = await f.seed({ companyId: "other", programId: "other-program", partnerId: "other-agent" });
    await f.db.insert(f.schema.submissions).values({ id: "private", companyId: other.companyId, programId: other.programId, missionId: other.missionId, partnerId: other.partnerId, type: "LEAD" });
    assert.equal((await f.request("/api/company/crm?id=private", undefined, { method: "GET", route: "/api/company/crm" })).status, 404);
    const patch = (body) => f.request("/api/submissions/lead-000", body, { method: "PATCH", route: "/api/submissions/[id]", params: { id: "lead-000" } });
    assert.equal((await patch({ assignedToUserId: "other-owner" })).status, 400);
    assert.equal((await patch({ assignedToUserId: "company-a-owner", nextAction: "Call client", nextActionAt: "2020-01-01T10:00:00Z", reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS" })).status, 200);
    const detail = await (await f.request("/api/company/crm?id=lead-000", undefined, { method: "GET", route: "/api/company/crm" })).json();
    assert.equal(detail.item.nextAction, "Call client");
    assert.equal(detail.item.assignedToUserId, "company-a-owner");
    assert.ok(detail.item.events.length);
    assert.ok((await crmBoard(company, { quick: "ACTION" })).items.some((item) => item.id === "lead-000"));
  } finally { f.close(); }
});
