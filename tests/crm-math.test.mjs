import test from "node:test";
import assert from "node:assert/strict";
import { calculateCrmGoal, crmStage, potentialForLead } from "../lib/crm.ts";

test("CRM goal math is stable for empty and invalid values", () => {
  assert.deepEqual(calculateCrmGoal(0, 0, 0, 0), { goal: 0, check: 0, conversion: 0, perAmbassador: 0, payments: 0, leads: 0, ambassadors: 0 });
  assert.equal(calculateCrmGoal(450000, 230016, 20, 3).payments, 2);
  assert.equal(calculateCrmGoal(450000, 230016, 20, 3).leads, 10);
  assert.equal(calculateCrmGoal(450000, 230016, 20, 3).ambassadors, 4);
  assert.equal(calculateCrmGoal(100, Number.NaN, 50, 1).payments, 0);
});

test("CRM stage uses existing review, sales and payout statuses", () => {
  assert.equal(crmStage({ reviewStatus: "PENDING", salesStatus: "NONE" }), "NEW");
  assert.equal(crmStage({ reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS" }), "WORK");
  assert.equal(crmStage({ reviewStatus: "ACCEPTED", salesStatus: "WON", reward: { status: "PAID", partnerConfirmedAt: "2026-01-01" } }), "PAID");
  assert.equal(crmStage({ reviewStatus: "REJECTED", salesStatus: "LOST" }), "CLOSED");
});

test("potential distinguishes exact, estimate and average fallback", () => {
  assert.equal(potentialForLead({ dealAmount: 500 }, 100).kind, "EXACT");
  assert.equal(potentialForLead({ estimatedDealAmount: 300 }, 100).kind, "ESTIMATED");
  assert.deepEqual(potentialForLead({}, 100), { amount: 100, kind: "AVERAGE" });
});
