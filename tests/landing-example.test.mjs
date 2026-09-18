import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { typescriptLoader } from "./helpers/load-typescript.mjs";
const window = new Window({ url: "https://risestaff.kz/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Event"]) Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LandingExample } = typescriptLoader()(new URL("../app/landing-example.tsx", import.meta.url));

test("landing example explains sale versus receipt, works backwards and never submits customer data", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("The example must not send a request"); };
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LandingExample)));
    const buttons = [...host.querySelectorAll("button")];
    assert.equal(buttons.length, 3);
    assert.match(host.textContent, /Пример для учебного центра/);
    assert.match(host.textContent, /После оплаты курса/);
    await act(async () => buttons[1].click());
    assert.match(host.textContent, /Курс оплачен/);
    assert.match(host.textContent, /К выплате/);
    await act(async () => buttons[2].click());
    assert.match(host.textContent, /Агент подтвердил получение/);
    assert.equal(host.querySelectorAll('[aria-pressed="true"]').length, 1);
    assert.ok(host.querySelector('[aria-live="polite"]'));
    await act(async () => buttons[0].click());
    assert.match(host.textContent, /Новая заявка/);
    assert.equal(host.querySelector("form"), null);
  } finally {
    await act(async () => root.unmount()); host.remove(); globalThis.fetch = original;
  }
});
