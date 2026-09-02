import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { authFixture } from "./helpers/auth-fixture.mjs";

const window = new Window({ url: "https://company.risestaff.kz/auth?returnTo=%2Fdashboard%2Fcrm" });
for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Event", "FormData"]) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");

async function setup() {
  const fixture = authFixture();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const { AuthFlow } = fixture.load(new URL("../app/auth/auth-flow.tsx", import.meta.url));
  const requests = [];
  let pending = Promise.resolve();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (path, options) => {
    const payload = JSON.parse(options.body);
    requests.push({ path, payload });
    pending = fixture.request(path, payload);
    return pending;
  };
  await act(async () => root.render(createElement(AuthFlow, { returnTo: "/dashboard/crm?result=123" })));
  function button(text) {
    const match = [...container.querySelectorAll("button")].find((node) => node.textContent === text);
    assert.ok(match, `Missing button ${text}`);
    return match;
  }
  return {
    ...fixture, container, requests, button,
    async fill(name, value) {
      const input = container.querySelector(`input[name="${name}"]`);
      assert.ok(input, `Missing input ${name}`);
      await act(async () => {
        if (input.type === "checkbox") input.click();
        else {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        }
      });
    },
    async click(text) { await act(async () => { button(text).click(); await pending; }); },
    async submit() {
      await act(async () => {
        container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await pending;
      });
    },
    async dispose() {
      await act(async () => root.unmount());
      container.remove();
      globalThis.fetch = originalFetch;
      fixture.close();
    },
  };
}

test("first screen has email/password; Enter calls login, never check-email or registration", async () => {
  const ui = await setup();
  try {
    await ui.seed();
    assert.match(ui.container.querySelector("h1").textContent, /Вход в кабинет компании/);
    assert.ok(ui.container.querySelector('input[autocomplete="current-password"]'));
    assert.equal(ui.container.querySelectorAll('button[type="submit"]').length, 1);
    await ui.fill("email", "existing@example.test");
    await ui.fill("password", "wrong");
    await ui.submit();
    assert.equal(ui.requests[0].path, "/api/auth/login");
    assert.match(ui.container.querySelector('[role="alert"]').textContent, /Неверный email или пароль/);
    assert.match(ui.container.querySelector("h1").textContent, /Вход/);
    await ui.fill("password", "ValidPass123");
    await ui.submit();
    assert.ok(ui.jar.get("relay_session"));
    assert.equal(ui.requests.at(-1).payload.returnTo, "/dashboard/crm?result=123");
    assert.ok(ui.requests.every((entry) => entry.path === "/api/auth/login"));
  } finally { await ui.dispose(); }
});

test("duplicate company registration returns to login with email retained and password recovery available", async () => {
  const ui = await setup();
  try {
    await ui.seed();
    await ui.fill("email", "existing@example.test");
    await ui.click("Нет аккаунта? Создать аккаунт");
    await ui.fill("name", "Test User");
    await ui.fill("phone", "+77770000000");
    await ui.fill("password", "Different123");
    await ui.fill("acceptedTerms", true);
    await ui.fill("acceptedPrivacy", true);
    await ui.submit();
    assert.match(ui.container.querySelector("h1").textContent, /Вход в кабинет компании/);
    assert.equal(ui.container.querySelector('input[name="email"]').value, "existing@example.test");
    assert.equal(ui.container.querySelector('input[name="password"]').value, "");
    assert.match(ui.container.querySelector('[role="status"]').textContent, /уже существует/);
    assert.ok(ui.button("Забыли пароль?"));
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.deliveries.length, 0);
  } finally { await ui.dispose(); }
});

test("password recovery accepts an editable email and returns to login after a real code reset", async () => {
  const ui = await setup();
  try {
    await ui.seed();
    await ui.click("Забыли пароль?");
    await ui.fill("email", "existing@example.test");
    await ui.submit();
    assert.equal(ui.deliveries[0].type, "reset");
    await ui.fill("code", ui.deliveries[0].code);
    await ui.fill("password", "NewPassword123");
    await ui.submit();
    assert.match(ui.container.querySelector("h1").textContent, /Пароль изменён/);
    await ui.click("Войти в RiseStaff");
    assert.equal(ui.container.querySelector('input[name="email"]').value, "existing@example.test");
    await ui.fill("password", "NewPassword123");
    await ui.submit();
    assert.ok(ui.jar.get("relay_session"));
  } finally { await ui.dispose(); }
});

test("pending account asks for an explicit code request, then verifies without repeating registration", async () => {
  const ui = await setup();
  try {
    await ui.seed("pending@example.test", "pending");
    await ui.fill("email", "pending@example.test");
    await ui.fill("password", "ValidPass123");
    await ui.submit();
    assert.equal(ui.deliveries.length, 0);
    await ui.click("Получить код подтверждения");
    assert.equal(ui.deliveries.length, 1);
    await ui.fill("code", ui.deliveries[0].code);
    await ui.submit();
    assert.ok(ui.jar.get("relay_session"));
    assert.equal(ui.requests.at(-1).payload.returnTo, "/dashboard/crm?result=123");
    assert.ok(ui.requests.every((entry) => entry.path !== "/api/auth/register"));
  } finally { await ui.dispose(); }
});

test("new company registration remains explicit and email activation opens the requested page", async () => {
  const ui = await setup();
  try {
    await ui.click("Нет аккаунта? Создать аккаунт");
    await ui.fill("email", "new@example.test");
    await ui.fill("name", "New Owner");
    await ui.fill("phone", "+77770000000");
    await ui.fill("password", "ValidPass123");
    await ui.fill("acceptedTerms", true);
    await ui.fill("acceptedPrivacy", true);
    await ui.submit();
    assert.match(ui.container.querySelector("h1").textContent, /Введите код из письма/);
    assert.equal(ui.jar.size, 0);
    assert.equal(ui.deliveries[0].type, "verify");
    await ui.fill("code", ui.deliveries[0].code);
    await ui.submit();
    assert.equal(ui.sqlite.prepare("SELECT status FROM users").get().status, "active");
    assert.ok(ui.jar.get("relay_session"));
    assert.equal(ui.requests.at(-1).payload.returnTo, "/dashboard/crm?result=123");
  } finally { await ui.dispose(); }
});
