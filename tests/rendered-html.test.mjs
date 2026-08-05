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
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
