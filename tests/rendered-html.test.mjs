import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

// Node has no Workers runtime. Invalid-token scenarios never access D1; keep
// only this runtime import stubbed while executing the complete built router.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = {};", shortCircuit: true };
  return nextResolve(specifier, context);
} });

async function render(pathname = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function route(url) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(url, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("routes each product surface to its canonical domain", async () => {
  const company = await route("https://risestaff.kz/dashboard/programs?view=active");
  assert.equal(company.status, 308);
  assert.equal(company.headers.get("location"), "https://company.risestaff.kz/dashboard/programs?view=active");

  const companyRoot = await route("https://company.risestaff.kz/");
  assert.equal(companyRoot.headers.get("location"), "https://company.risestaff.kz/dashboard");

  const agent = await route("https://relay-agent-sales-rustam.frosty-whale-0805.chatgpt.site/p/demo?access=token");
  assert.equal(agent.headers.get("location"), "https://agents.risestaff.kz/p/demo?access=token");

  const agentLogin = await route("https://risestaff.kz/agent-login");
  assert.equal(agentLogin.headers.get("location"), "https://agents.risestaff.kz/agent-login");

  const referral = await route("https://risestaff.kz/ref/client-token");
  assert.equal(referral.headers.get("location"), "https://agents.risestaff.kz/ref/client-token");

  const marketing = await route("https://agents.risestaff.kz/pricing");
  assert.equal(marketing.headers.get("location"), "https://risestaff.kz/pricing");
});

test("keeps Russian as default and restores the shared Kazakh preference", async () => {
  const response = await render("/", { cookie: "relay_locale=kk" });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="kk"/);
  assert.match(html, /class="active" aria-pressed="true">ҚАЗ/);
});

test("renders the RiseStaff landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /RiseStaff/);
  assert.match(html, /Заработать на рекомендациях/);
  assert.match(html, /https:\/\/agents\.risestaff\.kz\/p\/relay-kz-13c34fa/);
  assert.match(html, /<html lang="ru"/);
  assert.match(html, /relay-language-switcher/);
  assert.match(html, />ҚАЗ</);
  assert.match(html, /RiseStaff — новые клиенты через рекомендации/);
  assert.match(html, /rel="canonical" href="https:\/\/risestaff\.kz"/);
  assert.match(html, /rel="icon" href="\/icon-192\.png"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"alternateName":\["risestaff\.kz"\]/);
  assert.match(html, /lp-color-word/);
  assert.match(html, /рекомендации/);
  assert.match(html, /четыре понятных шага/i);
  assert.doesNotMatch(html, /Northstar CRM|внедрение CRM/i);
  assert.match(html, /Люди охотнее рекомендуют вас, когда правила понятны/);
  assert.doesNotMatch(html, /ТЕКУЩИЙ ПИЛОТ RISESTAFF/);
  assert.match(html, /RiseStaff — не биржа людей/);
  assert.match(html, /БОЛЬШЕ НОВЫХ КЛИЕНТОВ ИЗ ТЕХ, КТО УЖЕ ВАМ ДОВЕРЯЕТ/);
  assert.match(html, /образовательный центр продаёт годовой курс за 600 000 ₸/i);
  assert.doesNotMatch(html, /B2B-клиент|B2B-лид|B2B-продаж/i);
  assert.match(html, /ИИ соберёт черновик/);
  assert.doesNotMatch(html, /ранний доступ|бета-тест/i);
  assert.match(html, /Что нужно знать перед запуском/);
  assert.match(html, /Оставить заявку/);
  assert.match(html, /Заявка компании/);
  assert.match(html, /wa\.me\/77765086000/);
  assert.match(html, /Интеграторам/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("built company auth screen serves login immediately and never caches authentication pages", async () => {
  const response = await route("https://company.risestaff.kz/auth?returnTo=%2Fdashboard%2Fcrm");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const html = await response.text();
  assert.match(html, /Вход в кабинет компании/);
  assert.match(html, /autoComplete="current-password"/i);
  assert.match(html, /name="email"/);
  assert.match(html, /Забыли пароль/);
  assert.match(html, /Нет аккаунта\? Создать аккаунт/);
  assert.doesNotMatch(html, /name="intent"|Введите email, затем выберите/);
});

test("invalid agent and referral links render recovery guidance instead of a generic 404", async () => {
  for (const path of ["/partner/invalid-link", "/partner/invalid-link/profile", "/ref/invalid-link"]) {
    const response = await route(`https://agents.risestaff.kz${path}`);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    assert.match(html, /Ссылка недоступна/, path);
    assert.match(html, /Ваши ранее отправленные заявки не удалены/, path);
    assert.match(html, /href="\/agent-login"/, path);
    assert.doesNotMatch(html, /This page could not be found/, path);
  }
});

test("renders pricing without publishing prices", async () => {
  const response = await render("/pricing");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Варианты подключения/);
  assert.match(html, /С чего начать/);
  assert.match(html, /50 000 AI-кредитов/);
  assert.doesNotMatch(html, /бесплат|ранний доступ|бета-тест/i);
  assert.match(html, /rel="canonical" href="https:\/\/risestaff\.kz\/pricing"/);
  assert.doesNotMatch(html, /₸|₽/);
});

test("renders the integrator one-screen offer", async () => {
  const response = await render("/integrators");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Запускайте RiseStaff клиентам и зарабатывайте на настройке/);
  assert.match(html, /Настройте первую программу/);
  assert.match(html, /Обновляйте программы клиента/);
});
