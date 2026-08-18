import test from "node:test";
import assert from "node:assert/strict";
import { aiCreditLimit, calculateAiCredits } from "../lib/ai-credits.ts";
import { INITIAL_COMPANY_AI_CREDITS } from "../lib/company-credits.ts";

test("gives every new company a 50,000-credit starting balance", () => {
  assert.equal(INITIAL_COMPANY_AI_CREDITS, 50_000);
});

test("does not charge when Gemini was not used", () => {
  assert.equal(calculateAiCredits("PROFILE_ANALYSIS", { inputTokens: 0, outputTokens: 0 }), 0);
});

test("weights context below generated output and applies a minimum", () => {
  assert.equal(calculateAiCredits("ASSISTANT_REPLY", { inputTokens: 1, outputTokens: 0 }), 8);
  assert.equal(calculateAiCredits("ASSISTANT_REPLY", { inputTokens: 1000, outputTokens: 500, thoughtsTokens: 200 }), 115);
});

test("caps every operation even when provider usage spikes", () => {
  const huge = { inputTokens: 100000, outputTokens: 100000, thoughtsTokens: 100000 };
  assert.equal(calculateAiCredits("ASSISTANT_REPLY", huge), 120);
  assert.equal(calculateAiCredits("PROFILE_ANALYSIS", huge), 600);
  assert.equal(calculateAiCredits("PROGRAM_GENERATION", huge, 1), 450);
  assert.equal(calculateAiCredits("PROGRAM_GENERATION", huge, 4), 900);
  assert.equal(aiCreditLimit("PROGRAM_GENERATION", 3), 750);
});
