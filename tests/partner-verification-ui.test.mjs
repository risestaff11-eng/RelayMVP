import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

const window = new Window({ url: "https://agents.risestaff.kz/partner/test/profile" });
for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Event"]) Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");

test("contact verification shows cooldown, disables both actions and permits code reissue after waiting", async (context) => {
  const originalFetch = globalThis.fetch;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  context.mock.timers.enable({ apis: ["Date", "setInterval"], now: Date.now() });
  try {
    const { ContactVerification } = typescriptLoader({ "@/app/safe-link": { SafeLink: "a" } })(new URL("../app/partner/_components/partner-actions.tsx", import.meta.url));
    const requests = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/partner/verify");
      const body = JSON.parse(options.body);
      requests.push(body);
      return body.action === "REQUEST" ? Response.json({ ok: true }) : Response.json({ error: "Лимит попыток исчерпан", retryAfterSeconds: 3 }, { status: 429 });
    };
    await act(async () => root.render(createElement(ContactVerification, { token: "test-token", channel: "EMAIL", value: "agent@example.test", verified: false })));
    const button = (text) => [...container.querySelectorAll("button")].find((element) => element.textContent === text);
    await act(async () => button("Получить код").click());
    const input = container.querySelector("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "123456");
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await act(async () => button("Подтвердить").click());
    assert.equal(button("Подтвердить").disabled, true);
    assert.equal(button("Отправить код снова").disabled, true);
    assert.ok(container.textContent.includes("Повторная попытка через 3 с."));
    await act(async () => context.mock.timers.tick(3000));
    assert.equal(button("Отправить код снова").disabled, false);
    await act(async () => button("Отправить код снова").click());
    assert.equal(input.value, "");
    assert.deepEqual(requests.map((request) => request.action), ["REQUEST", "CONFIRM", "REQUEST"]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
    context.mock.timers.reset();
  }
});
