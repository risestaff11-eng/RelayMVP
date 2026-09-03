import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { typescriptLoader } from "./helpers/load-typescript.mjs";
import * as translations from "../lib/kazakh-translations.ts";
import * as crm from "../lib/crm.ts";
import * as display from "../lib/format-display.ts";
import * as workflow from "../lib/workflow.ts";

const window = new Window({ url: "https://company.risestaff.kz/dashboard/crm" });
for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Element", "Document", "Node", "NodeFilter", "MutationObserver", "Event", "FormData"]) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
}
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement, Fragment } = await import("react");
const { createRoot } = await import("react-dom/client");
const baseLoader = typescriptLoader();
const dom = baseLoader(new URL("../lib/i18n-dom.ts", import.meta.url));
const { localizeInterface } = baseLoader(new URL("../lib/interface-locale.ts", import.meta.url));

test("translation preserves entered data, explicit and implicit select values and protected records", () => {
  const container = document.createElement("div");
  container.innerHTML = `<form><label>Название компании</label><input name="company" value="Новый" placeholder="Название компании" />
    <textarea name="comment">В работе</textarea><div contenteditable="true">Новый</div>
    <bdi data-no-translate>Новый</bdi><span translate="no">Программа</span>
    <select name="implicit"><option>Новый</option><option>В работе</option></select>
    <select name="status"><option value="WON">Оплачено клиентом</option></select>
    <img alt="Кабинет агента" /><button title="Сохранить" aria-label="Сохранить">Сохранить</button></form>`;
  document.body.append(container);
  const before = Object.fromEntries(new FormData(container.querySelector("form")));
  dom.translateInterfaceTree(container);
  assert.deepEqual(Object.fromEntries(new FormData(container.querySelector("form"))), before);
  assert.equal(container.querySelector("textarea").value, "В работе");
  assert.equal(container.querySelector("[contenteditable]").textContent, "Новый");
  assert.equal(container.querySelector("bdi").textContent, "Новый");
  assert.equal(container.querySelector('[translate="no"]').textContent, "Программа");
  assert.equal(container.querySelector("option").textContent, translations.translateToKazakh("Новый"));
  assert.equal(container.querySelector("img").alt, "Агент кабинеті");
  assert.equal(container.querySelector("button").getAttribute("aria-label"), translations.translateToKazakh("Сохранить"));
  const once = container.innerHTML;
  dom.translateInterfaceTree(container);
  assert.equal(container.innerHTML, once, "Applying the observer again must be idempotent");
  container.remove();
});

test("counts, dates, decorated labels and native confirmations retain their contracts", () => {
  const t = translations.translateToKazakh;
  assert.equal(t("21 заявка"), "21 өтінім");
  assert.equal(t("12 заявок · 4 сделки · 3 выплаты"), "12 өтінім · 4 мәміле · 3 төлем");
  assert.equal(t("02 сентября"), "02 қыркүйек");
  assert.equal(t("03 сент., 12:30"), "03 қыр, 12:30");
  assert.equal(t("  Открыть   задания  "), "  Тапсырмаларды ашу  ");
  assert.equal(t("Удалить задание «Школа Qadam»?"), "«Школа Qadam» тапсырмасын жою керек пе?");
  assert.equal(t("Удалить задание «Школа 5 дней»?"), "«Школа 5 дней» тапсырмасын жою керек пе?");
  assert.equal(t("Открыть карточку клиента Новый"), "Новый клиентінің карточкасын ашу");
  document.documentElement.lang = "ru";
  assert.equal(localizeInterface("Сохранить"), "Сохранить");
  document.documentElement.lang = "kk";
  assert.equal(localizeInterface("Сохранить"), t("Сохранить"));
  const deletion = localizeInterface("Будут удалены кабинет «Northstar», 2 программы, 3 агента и 5 результатов.\n\nДля подтверждения введите УДАЛИТЬ");
  assert.ok(deletion.includes("Northstar"));
  assert.ok(deletion.includes("УДАЛИТЬ"), "Do not translate a required confirmation token");
  assert.ok(deletion.includes("2 бағдарлама"));
});

test("Kazakh company registration submits the same enums and entered company data", async () => {
  const requests = [], redirects = [];
  const load = typescriptLoader({ "next/navigation": { useRouter: () => ({ push: (url) => redirects.push(url), refresh() {} }) } });
  const { CompanyRegistrationForm } = load(new URL("../app/onboarding/registration-form.tsx", import.meta.url));
  const container = document.createElement("div");document.body.append(container);
  const root = createRoot(container), originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json({ ok: true }); };
    await act(async () => root.render(createElement(CompanyRegistrationForm, { email: "owner@example.test" })));
    dom.translateInterfaceTree(container);
    container.querySelector('[name="name"]').value = "Новый";
    container.querySelector('[name="website"]').value = "example.test";
    container.querySelector('[name="industry"]').value = "EDUCATION";
    container.querySelector('[name="teamSize"]').value = "1_10";
    assert.equal(container.querySelector('button[type="submit"]').textContent, translations.translateToKazakh("Создать компанию и открыть кабинет →"));
    await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.deepEqual(requests, [{ url: "/api/company/register", body: { name: "Новый", website: "example.test", industry: "EDUCATION", teamSize: "1_10", primaryGoal: "LEADS", contactEmail: "owner@example.test" } }]);
    assert.deepEqual(redirects, ["/dashboard"]);
  } finally { globalThis.fetch = originalFetch; await act(async () => root.unmount());container.remove(); }
});

test("real CRM translates new DOM after status changes while preserving client identity and payout payload", async () => {
  const load = typescriptLoader({ "@/lib/crm": crm, "@/lib/format-display": display, "@/lib/workflow": workflow, "@/lib/kazakh-translations": translations, "@/lib/i18n-dom": dom });
  const { CrmWorkspace } = load(new URL("../app/dashboard/crm/crm-workspace.tsx", import.meta.url));
  const { LanguageSwitcher } = load(new URL("../app/language-switcher.tsx", import.meta.url));
  const item = { id: "lead-1", programName: "Программа", missionTitle: "Задание", contactName: "Новый", contactCompany: "Школа", contactPhone: "+77761234567", contactEmail: "client@example.test", partnerName: "Агент", partnerEmail: "agent@example.test", partnerPhone: "+77761234568", partnerComment: "В работе", audioTranscript: "", companyComment: "", status: "SUBMITTED", reviewStatus: "PENDING", salesStatus: "NONE", ownershipStatus: "CLEAR", reviewDueAt: null, estimatedDealAmount: 200000, dealAmount: 200000, rewardMode: "FIXED", rewardValue: 25000, rewardLabel: "", currency: "KZT", submittedByClient: false, referralSource: "AGENT", customAnswers: [], events: [], attachments: [], reward: null, createdAt: "2026-09-03T10:00:00Z" };
  const container = document.createElement("div");document.body.append(container);
  const root = createRoot(container), originalFetch = globalThis.fetch, requests = [];
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  try {
    document.documentElement.lang = "kk";
    globalThis.fetch = async (url, options) => { const body = JSON.parse(options.body);requests.push({ url, body });return Response.json({ status: "REWARDED", reviewStatus: body.reviewStatus, salesStatus: body.salesStatus, rewardAmount: 25000, rewardStatus: "APPROVED" }); };
    await act(async () => root.render(createElement(Fragment, null, createElement(CrmWorkspace, { companyName: "Компания", initialItems: [item], initialSettings: { monthlyGoal: 1000000, averageCheck: 200000, conversionRate: 20, currency: "KZT" } }), createElement(LanguageSwitcher, { locale: "kk" }))));
    await settle();
    const card = container.querySelector(".crm-lead-card");
    assert.equal(card.querySelector("h3").textContent, "Новый");
    assert.equal(card.querySelector(".crm-card-top strong").textContent, "Программа");
    assert.equal(card.querySelector("p").textContent, "В работе");
    const select = card.querySelector("select");
    assert.deepEqual([...select.options].map((option) => option.value), crm.CRM_STAGES.map((stage) => stage.id));
    assert.deepEqual([...select.options].map((option) => option.textContent), crm.CRM_STAGES.map((stage) => translations.translateToKazakh(stage.label)));
    await act(async () => { select.value = "PAID"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await settle();
    assert.equal(requests[0].body.salesStatus, "WON");
    assert.equal(requests[0].body.reviewStatus, "ACCEPTED");
    assert.equal(Object.hasOwn(requests[0].body, "amount"), false, "Stage changes must not overwrite the negotiated reward");
    assert.ok(container.querySelector(".crm-stage-paid .crm-lead-card"));
    assert.ok(container.querySelector(".crm-payout-state").textContent.includes(translations.translateToKazakh("Ожидает выплаты")));
    await act(async () => container.querySelector(".crm-lead-card").click());
    await settle();
    assert.equal(container.querySelector("#crm-lead-title").textContent, "Новый");
    assert.equal(container.querySelector(".crm-fullscreen-context span").textContent, "Программа");
    assert.ok(container.querySelector('a[href^="https://wa.me/77761234567"]'));
    assert.ok(container.querySelector(".crm-lead-fullscreen").textContent.includes(translations.translateToKazakh("Сохранить и обновить")));
  } finally { globalThis.fetch = originalFetch; await act(async () => root.unmount());container.remove(); }
});
