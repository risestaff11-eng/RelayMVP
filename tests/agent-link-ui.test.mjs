import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { typescriptLoader } from "./helpers/load-typescript.mjs";

const load = typescriptLoader();
function render(Component, props) {
  const window = new Window();
  window.document.body.innerHTML = renderToStaticMarkup(createElement(Component, props));
  return window.document.body;
}

test("access expiry is collapsed, uses the actual timestamp and includes a renewal link", () => {
  const { AccessLinkExpiry } = load(new URL("../app/partner/_components/access-link-expiry.tsx", import.meta.url));
  const now = Date.parse("2026-09-03T10:00:00Z");
  const expiry = "2026-09-06T10:00:00Z";
  const body = render(AccessLinkExpiry, { expiresAt: expiry, now });
  assert.equal(body.querySelector("details").open, false);
  assert.equal(body.querySelector("time").dateTime, expiry);
  assert.equal(body.querySelector("a").getAttribute("href"), "/agent-login");
  assert.ok(body.querySelector("summary").textContent.includes("06 сентября"));
  const soon = render(AccessLinkExpiry, { expiresAt: "2026-09-04T09:00:00Z", now });
  assert.equal(soon.querySelector("summary").textContent, "Ссылка истекает меньше чем через сутки");
  assert.equal(render(AccessLinkExpiry, { expiresAt: "not-a-date", now }).textContent, "");
});

test("error recovery has a retry action and account entrance; unknown links do not expose internals", () => {
  const { AgentLinkProblem } = load(new URL("../app/agent-link-problem.tsx", import.meta.url));
  const error = render(AgentLinkProblem, { temporary: true, reset() {} });
  assert.equal(error.querySelector("button").textContent, "Попробовать ещё раз");
  assert.equal(error.querySelector("a").getAttribute("href"), "/agent-login");
  const missing = render(AgentLinkProblem, {});
  assert.equal(missing.querySelector("button"), null);
  assert.equal(missing.querySelector("h1").textContent, "Ссылка недоступна");
  const { translateToKazakh } = load(new URL("../lib/kazakh-translations.ts", import.meta.url));
  for (const element of missing.querySelectorAll("h1, p, a")) assert.notEqual(translateToKazakh(element.textContent), element.textContent);
});
