import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { typescriptLoader } from "./helpers/load-typescript.mjs";
const window = new Window({ url: "https://company.risestaff.kz/dashboard/rewards" });
for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Event", "FormData"]) Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const load = typescriptLoader({ "next/navigation": { useRouter: () => ({ refresh() {} }) } });
const { RewardLedger } = load(new URL("../app/dashboard/rewards/reward-ledger.tsx", import.meta.url));
const { ProgramQuickActions } = load(new URL("../app/dashboard/_components/program-quick-actions.tsx", import.meta.url));
async function mount(Component, props) {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); await act(async () => root.render(createElement(Component, props)));
  return { host, async close() { await act(async () => root.unmount()); host.remove(); } };
}
const row = { id: "r", submissionId: "lead", agentName: "Agent", agentEmail: "agent@example.test", missionTitle: "Task", programName: "Program", contactName: "Client", contactCompany: "", amount: 25000, currency: "KZT", status: "APPROVED", approvedAt: "2026-01-01", plannedAt: null, paidAt: null, partnerConfirmedAt: null, createdAt: "2026-01-01" };
function button(host, text) { return [...host.querySelectorAll("button")].find((node) => node.textContent === text); }

test("company transfer requires explicit confirmation, guards double click and preserves retry after network error", async () => {
  const original = globalThis.fetch; const calls = []; let release; let ui;
  globalThis.fetch = (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); return new Promise((resolve, reject) => { release = reject; }); };
  try {
    ui = await mount(RewardLedger, { initialRows: [row], payoutSlaDays: 7, canManage: true, canExport: true });
    assert.equal(ui.host.querySelector('a[href="/dashboard/crm?submission=lead"]').textContent, "Открыть клиента в CRM →");
    await act(async () => button(ui.host, "Отметить перевод").click());
    assert.equal(calls.length, 0);
    assert.match(ui.host.querySelector(".company-transfer-confirm").textContent, /Agent/);
    await act(async () => { button(ui.host, "Да, деньги переведены").click(); button(ui.host, "Да, деньги переведены").click(); });
    assert.equal(calls.length, 1);
    await act(async () => release(new Error("Connection failed")));
    assert.match(ui.host.querySelector('[role="status"]').textContent, /Connection failed/);
    assert.ok(button(ui.host, "Да, деньги переведены"));
    globalThis.fetch = async () => Response.json({ paidAt: "2026-09-16", partnerConfirmedAt: null });
    await act(async () => button(ui.host, "Да, деньги переведены").click());
    assert.equal(ui.host.querySelector(".company-transfer-confirm"), null);
    assert.match(ui.host.textContent, /Компания отметила перевод/);
    assert.match(ui.host.textContent, /Ожидаем/);
  } finally { if (ui) await ui.close(); globalThis.fetch = original; }
});

test("company read-only role sees no financial mutation or export buttons", async () => {
  const ui = await mount(RewardLedger, { initialRows: [row], payoutSlaDays: 7 });
  try {
    assert.equal(button(ui.host, "Отметить перевод"), undefined);
    assert.equal(button(ui.host, "Скорректировать сумму"), undefined);
    assert.equal(button(ui.host, "Скачать реестр ↓"), undefined);
    assert.ok(ui.host.querySelector('a[href*="submission=lead"]'));
  } finally { await ui.close(); }
});

test("program controls recover from unavailable server and allow a retry", async () => {
  const original = globalThis.fetch; let ui;
  globalThis.fetch = async () => { throw new Error("Offline"); };
  try {
    ui = await mount(ProgramQuickActions, { id: "p", initialStatus: "ACTIVE" });
    await act(async () => ui.host.querySelector('button[aria-label="Поставить программу на паузу"]').click());
    assert.match(ui.host.textContent, /Повторите попытку/);
    assert.equal(ui.host.querySelector("button").disabled, false);
    globalThis.fetch = async () => Response.json({ status: "PAUSED" });
    await act(async () => ui.host.querySelector('button[aria-label="Поставить программу на паузу"]').click());
    assert.ok(ui.host.querySelector('button[aria-label="Возобновить программу"]'));
  } finally { if (ui) await ui.close(); globalThis.fetch = original; }
});
