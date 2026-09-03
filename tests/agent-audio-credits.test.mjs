import assert from "node:assert/strict";
import test from "node:test";
import { agentFixture } from "./helpers/agent-fixture.mjs";

const draft = { inputTokens: 100, outputTokens: 50, data: { transcript: "A client needs a course", answers: [{ fieldId: "contact-name", value: "Client", confidence: 0.9 }, { fieldId: "invented-field", value: "ignored", confidence: 1 }], missingFields: ["contact-phone", "invented-field"], durationSeconds: 12 } };
function audioForm(agent, duration = 12) {
  const form = new FormData();
  form.set("token", agent.token);
  form.set("missionId", agent.missionId);
  form.set("durationSeconds", String(duration));
  form.set("audio", new File(["test-audio-boundary"], "voice.webm", { type: "audio/webm" }));
  return form;
}
function balance(f) {
  const row = f.sqlite.prepare("SELECT ai_token_balance, ai_tokens_used FROM companies WHERE id = 'company-a'").get();
  return [row.ai_token_balance, row.ai_tokens_used];
}

test("audio uses the shared reservation and settles actual usage without submitting the draft", async () => {
  const f = agentFixture();
  try {
    const agent = await f.seed();
    f.sqlite.prepare("UPDATE companies SET ai_token_balance = 200, ai_tokens_used = 0").run();
    f.load(new URL("../lib/ai.ts", import.meta.url)).generateStructuredJsonFromAudio = async () => {
      assert.deepEqual(balance(f), [80, 120]);
      return draft;
    };
    const response = await f.request("/api/partner/audio/transcribe", audioForm(agent));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.creditsSpent, 20);
    assert.deepEqual(balance(f), [180, 20]);
    assert.equal(data.transcript, draft.data.transcript);
    assert.deepEqual(data.answers.map((answer) => answer.fieldId), ["contact-name"]);
    assert.deepEqual(data.missingFields, ["contact-phone"]);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM submissions").get().n, 0);
  } finally { f.close(); }
});

test("provider failure refunds the reservation; invalid duration consumes no credits", async () => {
  const f = agentFixture();
  try {
    const agent = await f.seed();
    f.sqlite.prepare("UPDATE companies SET ai_token_balance = 200, ai_tokens_used = 0").run();
    let calls = 0;
    f.load(new URL("../lib/ai.ts", import.meta.url)).generateStructuredJsonFromAudio = async () => { calls++; throw new Error("Provider unavailable"); };
    assert.equal((await f.request("/api/partner/audio/transcribe", audioForm(agent, 61))).status, 400);
    assert.equal(calls, 0);
    assert.equal((await f.request("/api/partner/audio/transcribe", audioForm(agent))).status, 400);
    assert.equal(calls, 1);
    assert.deepEqual(balance(f), [200, 0]);
  } finally { f.close(); }
});

test("overlapping audio requests cannot spend the same company credits twice", async () => {
  const f = agentFixture();
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  let started;
  const providerStarted = new Promise((resolve) => { started = resolve; });
  let first;
  try {
    const agent = await f.seed();
    f.sqlite.prepare("UPDATE companies SET ai_token_balance = 120, ai_tokens_used = 0").run();
    let calls = 0;
    f.load(new URL("../lib/ai.ts", import.meta.url)).generateStructuredJsonFromAudio = async () => { calls++; started(); await hold; return draft; };
    first = f.request("/api/partner/audio/transcribe", audioForm(agent));
    await providerStarted;
    assert.deepEqual(balance(f), [0, 120]);
    assert.equal((await f.request("/api/partner/audio/transcribe", audioForm(agent))).status, 402);
    release();
    assert.equal((await first).status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(balance(f), [100, 20]);
  } finally { release(); if (first) await first; f.close(); }
});
