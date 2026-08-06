import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Relay landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Relay/);
  assert.match(html, /Превратите рекомендации в управляемый канал продаж/);
  assert.match(html, /ПЛАТФОРМА ПАРТНЁРСКИХ ПРОДАЖ/);
  assert.match(html, /Вопросы до запуска/);
  assert.match(html, /wa\.me\/77765086000/);
  assert.match(html, /Стать интегратором/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renders pricing without publishing prices", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Варианты подключения/);
  assert.match(html, /Почему без цен/);
  assert.doesNotMatch(html, /₸|₽/);
});

test("renders the integrator one-screen offer", async () => {
  const response = await render("/integrators");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Станьте интегратором партнёрских продаж/);
  assert.match(html, /Зарабатывайте на запуске/);
  assert.match(html, /Получайте повторные проекты/);
});
