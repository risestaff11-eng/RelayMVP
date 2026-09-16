import assert from "node:assert/strict";
import test from "node:test";
import { typescriptLoader } from "./helpers/load-typescript.mjs";
const load = typescriptLoader();
const { nextCompanyProgram, companyPayoutSla, matchesPayoutFilter, payoutFilter, payoutCsvCell } = load(new URL("../lib/company-workspace.ts", import.meta.url));

test("company next action never targets an archive and prefers a published program", () => {
  const archive = { id: "archive", status: "ARCHIVED" };
  const draft = { id: "draft", status: "DRAFT" };
  const paused = { id: "paused", status: "PAUSED" };
  const active = { id: "active", status: "ACTIVE" };
  assert.equal(nextCompanyProgram([archive, draft, paused, active]), active);
  assert.equal(nextCompanyProgram([archive, paused, draft]), draft);
  assert.equal(nextCompanyProgram([archive, paused]), paused);
  assert.equal(nextCompanyProgram([archive]), undefined);
  assert.equal(nextCompanyProgram([]), undefined);
});

test("only approved debt is overdue; transfer and receipt are separate filters", () => {
  const now = Date.parse("2026-09-16T12:00:00Z");
  const row = { status: "APPROVED", approvedAt: "2026-09-01T12:00:00Z", plannedAt: null, createdAt: "2026-08-01T12:00:00Z", partnerConfirmedAt: null };
  assert.equal(companyPayoutSla(row, 7, now).overdue, true);
  assert.equal(matchesPayoutFilter(row, "OVERDUE", 7, now), true);
  for (const status of ["PENDING", "CANCELLED", "PAID"]) {
    assert.equal(companyPayoutSla({ ...row, status }, 7, now).overdue, false);
  }
  assert.equal(companyPayoutSla({ ...row, plannedAt: "2026-09-20" }, 7, now).overdue, false);
  assert.equal(matchesPayoutFilter({ ...row, status: "PAID" }, "AWAITING_RECEIPT", 7, now), true);
  assert.equal(matchesPayoutFilter({ ...row, status: "PAID", partnerConfirmedAt: "2026-09-16" }, "CONFIRMED", 7, now), true);
  assert.equal(matchesPayoutFilter({ ...row, status: "PAID", partnerConfirmedAt: "2026-09-16" }, "AWAITING_RECEIPT", 7, now), false);
  assert.equal(payoutFilter("invalid"), "ALL");
  assert.equal(payoutFilter("OVERDUE"), "OVERDUE");
});

test("payout CSV preserves text but does not execute spreadsheet formulas", () => {
  assert.equal(payoutCsvCell('Name "quoted"'), '"Name ""quoted"""');
  assert.equal(payoutCsvCell(25000), '"25000"');
  for (const value of ["=1+1", "+77012345678", "@SUM(A1)", "-1+2", "  =1", "\t=1"]) {
    assert.ok(payoutCsvCell(value).startsWith('"\''));
  }
});
