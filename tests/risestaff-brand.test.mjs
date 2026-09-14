import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { agentFixture } from "./helpers/agent-fixture.mjs";

test("old and branded program URLs use the same mission, agent and submission workflow", async () => {
  for (const slug of ["relay-kz-13c34fa", "risestaff-13c34fa"]) {
    const f = agentFixture();
    try {
      const a = await f.seed({ programId: "relay-kz-13c34fa" });
      const query = f.load(new URL("../db/programs.ts", import.meta.url));
      const program = await query.getPublicProgramBySlug(slug);
      assert.equal(program.id, a.programId);
      assert.equal(program.slug, "risestaff-13c34fa");
      const form = f.form(a); form.set("programSlug", slug);
      const response = await f.request("/api/public/submissions", form);
      assert.equal(response.status, 201, await response.clone().text());
      assert.equal(f.sqlite.prepare("SELECT program_id FROM submissions").get().program_id, a.programId);
    } finally { f.close(); }
  }
});

test("brand maintenance is scoped, repeatable and preserves money, IDs, links and profile history", async () => {
  const f = agentFixture();
  try {
    const id = "6bb4e206-ec6d-475e-b3f1-250fff3b2a57";
    const a = await f.seed({ companyId: id, programId: "relay-kz-13c34fa" });
    const other = await f.seed({ companyId: "customer", programId: "other", partnerId: "other-agent", userId: "other-user" });
    for (const companyId of [id, other.companyId]) await f.db.update(f.schema.companies).set({ name: "Relay.kz", website: "https://risestaff.kz" }).where(eq(f.schema.companies.id, companyId));
    await f.db.update(f.schema.programs).set({ name: "Программа Relay", description: "Рекомендуйте Relay.kz" }).where(eq(f.schema.programs.id, a.programId));
    await f.db.insert(f.schema.companyProfileVersions).values({ id: "original", companyId: id, versionNumber: 1, sourceWebsite: "https://risestaff.kz", status: "CONFIRMED", model: "original", businessDescription: "Relay.kz помогает", confirmedAt: "2026-08-01" });
    const service = f.load(new URL("../lib/risestaff-brand-maintenance.ts", import.meta.url));
    assert.ok((await service.updateRiseStaffBrand()).changedRecords > 0);
    assert.equal((await service.updateRiseStaffBrand()).changedRecords, 0);
    assert.equal(f.sqlite.prepare("SELECT name FROM companies WHERE id=?").get(id).name, "RiseStaff");
    assert.equal(f.sqlite.prepare("SELECT name FROM companies WHERE id='customer'").get().name, "Relay.kz");
    const program = f.sqlite.prepare("SELECT * FROM programs WHERE id=?").get(a.programId);
    assert.equal(program.slug, "relay-kz-13c34fa");
    assert.equal(program.name, "Программа RiseStaff");
    assert.equal(program.status, "ACTIVE");
    assert.equal(f.sqlite.prepare("SELECT reward_value FROM missions WHERE id=?").get(a.missionId).reward_value, 25000);
    const profiles = f.sqlite.prepare("SELECT * FROM company_profile_versions ORDER BY version_number").all();
    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].business_description, "Relay.kz помогает");
    assert.equal(profiles[1].business_description, "RiseStaff помогает");
    assert.equal(profiles[1].status, "CONFIRMED");
    assert.equal(service.replaceLegacyBrand("Relay: https://t.me/relayagents"), "RiseStaff: https://t.me/relayagents");
    const auth = f.load(new URL("../lib/account-auth.ts", import.meta.url));
    auth.hasAdminSession = async () => false;
    assert.equal((await f.request("/api/system/brand", {})).status, 403);
  } finally { f.close(); }
});
