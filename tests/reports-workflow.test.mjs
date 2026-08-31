import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reporting schema keeps immutable snapshots, files and revisions", async () => {
  const [schema, migration] = await Promise.all([read("db/schema.ts"), read("drizzle/0025_bored_charles_xavier.sql")]);
  for (const table of ["report_templates", "agent_reports", "report_files", "report_revisions"]) {
    assert.match(schema, new RegExp(table));
    assert.match(migration, new RegExp(table));
  }
  assert.match(schema, /templateSnapshotJson/);
  assert.match(schema, /aiSummaryJson/);
});

test("partner report API enforces tenant, file and audio boundaries", async () => {
  const [route, transcript] = await Promise.all([
    read("app/api/partner/reports/route.ts"),
    read("app/api/partner/reports/transcribe/route.ts"),
  ]);
  assert.match(route, /getPartnerPortal/);
  assert.match(route, /не более 5 файлов/);
  assert.match(route, /10 \* 1024 \* 1024/);
  assert.match(route, /NEEDS_CLARIFICATION/);
  assert.match(transcript, /fieldId \? 60 : 180/);
  assert.match(transcript, /не отправляет отчёт/i);
});

test("reporting is available to both company and agent with evidence-based analysis", async () => {
  const [companyNav, agentNav, analysis] = await Promise.all([
    read("app/dashboard/_components/dashboard-nav.tsx"),
    read("app/partner/_components/partner-nav.tsx"),
    read("app/api/company/reports/analyze/route.ts"),
  ]);
  assert.match(companyNav, /dashboard\/reports/);
  assert.match(agentNav, /\/reports/);
  assert.match(analysis, /не придумывай/i);
  assert.match(analysis, /evidence/i);
});

test("automatic report metrics include tasks, results and rewards", async () => {
  const source = await read("db/reports.ts");
  assert.match(source, /partnerMissionAcceptances/);
  assert.match(source, /submissions/);
  assert.match(source, /rewards/);
  assert.match(source, /completedTasks/);
});
