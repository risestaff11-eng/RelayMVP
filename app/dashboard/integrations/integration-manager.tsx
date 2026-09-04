"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationOverview } from "../../../lib/integrations/service";


const eventOptions = [
  { value: "submission.created", label: "Новая заявка" },
  { value: "submission.updated", label: "Изменение заявки" },
  { value: "reward.updated", label: "Изменение выплаты" },
];
const scopeOptions = [
  { value: "integrations:read", label: "Проверка подключения" },
  { value: "programs:read", label: "Чтение программ" },
  { value: "agents:read", label: "Чтение агентов" },
  { value: "leads:write", label: "Создание заявок" },
];

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ru-KZ", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function deliveryLabel(status: string) {
  return ({ DELIVERED: "Доставлено", PENDING: "В очереди", PROCESSING: "Отправляется", RETRY: "Повтор", FAILED: "Ошибка" } as Record<string, string>)[status] || status;
}

export function IntegrationManager({ initial }: { initial: IntegrationOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [events, setEvents] = useState(["submission.created", "submission.updated", "reward.updated"]);
  const [scopes, setScopes] = useState(["integrations:read", "programs:read", "agents:read"]);
  const summary = useMemo(() => ({ active: initial.connections.filter((item) => item.status === "ACTIVE").length, errors: initial.deliveries.filter((item) => item.status === "FAILED").length, keys: initial.apiKeys.filter((item) => !item.revokedAt).length }), [initial]);

  async function request(path: string, init: RequestInit) {
    setBusy(path); setMessage("");
    try {
      const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error || "Не удалось выполнить действие"));
      router.refresh();
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выполнить действие");
      return null;
    } finally { setBusy(""); }
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await request("/api/company/integrations", { method: "POST", body: JSON.stringify({ name: form.get("name"), url: form.get("url"), eventTypes: events }) });
    const connection = data?.connection as { signingSecret?: string } | undefined;
    if (connection?.signingSecret) setSecret({ title: "Секрет подписи webhook", value: connection.signingSecret });
    if (data) event.currentTarget.reset();
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = await request("/api/company/integrations/api-keys", { method: "POST", body: JSON.stringify({ name: form.get("name"), scopes }) });
    const key = data?.apiKey as { token?: string } | undefined;
    if (key?.token) setSecret({ title: "Новый API-ключ", value: key.token });
    if (data) event.currentTarget.reset();
  }

  return <div className="dashboard-content integrations-page">
    <header className="integration-heading"><div><span className="module-kicker">ЕДИНЫЙ ИНТЕГРАЦИОННЫЙ СЛОЙ</span><h1>Интеграции</h1><p>Передавайте события RiseStaff во внешние сервисы и управляйте доступом к API.</p></div><span className="integration-version">API v1</span></header>
    <section className="integration-summary"><article><small>АКТИВНЫХ WEBHOOKS</small><strong>{summary.active}</strong></article><article><small>ОШИБОК ДОСТАВКИ</small><strong>{summary.errors}</strong></article><article><small>АКТИВНЫХ API-КЛЮЧЕЙ</small><strong>{summary.keys}</strong></article></section>
    {message && <div className="integration-alert error" role="alert">{message}</div>}
    {secret && <div className="integration-secret" role="status"><div><strong>{secret.title}</strong><p>Скопируйте сейчас. После закрытия значение больше не показывается.</p><code data-no-translate>{secret.value}</code></div><div><button type="button" onClick={() => navigator.clipboard.writeText(secret.value)}>Копировать</button><button type="button" onClick={() => setSecret(null)}>Закрыть</button></div></div>}

    <div className="integration-grid"><section className="integration-panel"><header><div><h2>Исходящие webhooks</h2><p>RiseStaff отправит событие сразу после изменения данных.</p></div></header><form className="integration-form" onSubmit={createWebhook}><label>Название<input name="name" required maxLength={80} placeholder="Например, CRM компании" /></label><label>Адрес webhook<input name="url" type="url" required placeholder="https://example.kz/webhooks/risestaff" /></label><fieldset><legend>Какие события отправлять</legend>{eventOptions.map((item) => <label key={item.value}><input type="checkbox" checked={events.includes(item.value)} onChange={() => setEvents((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])} />{item.label}</label>)}</fieldset><button className="integration-primary" disabled={!!busy} type="submit">Создать webhook</button></form>
      <div className="integration-list">{initial.connections.length ? initial.connections.map((connection) => <article key={connection.id}><div><strong>{<bdi data-no-translate>{connection.name}</bdi>}</strong><code data-no-translate>{connection.config.url}</code><small>Успешно: {dateTime(connection.lastSuccessAt)}{connection.lastError ? ` · ${connection.lastError}` : ""}</small></div><span className={`integration-status ${connection.status.toLowerCase()}`}>{connection.status === "ACTIVE" ? "Активен" : "На паузе"}</span><div className="integration-actions"><button disabled={!!busy} type="button" onClick={() => request(`/api/company/integrations/${connection.id}/test`, { method: "POST", body: "{}" })}>Проверить</button><button disabled={!!busy} type="button" onClick={() => request(`/api/company/integrations/${connection.id}`, { method: "PATCH", body: JSON.stringify({ status: connection.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }) })}>{connection.status === "ACTIVE" ? "Поставить на паузу" : "Включить"}</button></div></article>) : <p className="integration-empty">Webhooks ещё не созданы.</p>}</div>
    </section>

    <section className="integration-panel"><header><div><h2>API-ключи</h2><p>Каждый ключ получает только выбранные разрешения.</p></div></header><form className="integration-form" onSubmit={createKey}><label>Название<input name="name" required maxLength={80} placeholder="Например, интеграция с CRM" /></label><fieldset><legend>Разрешения</legend>{scopeOptions.map((item) => <label key={item.value}><input type="checkbox" checked={scopes.includes(item.value)} onChange={() => setScopes((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])} />{item.label}</label>)}</fieldset><button className="integration-primary" disabled={!!busy} type="submit">Создать API-ключ</button></form>
      <div className="integration-list">{initial.apiKeys.length ? initial.apiKeys.map((key) => <article key={key.id}><div><strong>{<bdi data-no-translate>{key.name}</bdi>}</strong><code data-no-translate>{key.tokenPrefix}••••••</code><small>{key.revokedAt ? `Отозван: ${dateTime(key.revokedAt)}` : `Последнее использование: ${dateTime(key.lastUsedAt)}`}</small></div><span className={`integration-status ${key.revokedAt ? "paused" : "active"}`}>{key.revokedAt ? "Отозван" : "Активен"}</span>{!key.revokedAt && <div className="integration-actions"><button disabled={!!busy} type="button" onClick={() => request(`/api/company/integrations/api-keys/${key.id}`, { method: "DELETE" })}>Отозвать</button></div>}</article>) : <p className="integration-empty">API-ключей ещё нет.</p>}</div>
    </section></div>

    <section className="integration-panel integration-journal"><header><div><h2>Журнал доставки</h2><p>Здесь видны попытки, ответы внешнего сервиса и ошибки.</p></div></header>{initial.deliveries.length ? <div className="integration-table"><div className="integration-table-head"><span>Событие</span><span>Подключение</span><span>Статус</span><span>Попытки</span><span>Время</span><span /></div>{initial.deliveries.map((delivery) => <div key={delivery.id}><span><strong>{delivery.eventType}</strong>{delivery.lastError && <small>{delivery.lastError}</small>}</span><span>{<bdi data-no-translate>{delivery.connectionName}</bdi>}</span><span><i className={`integration-dot ${delivery.status.toLowerCase()}`} />{deliveryLabel(delivery.status)}{delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ""}</span><span>{delivery.attemptCount}</span><span>{dateTime(delivery.createdAt)}</span><span>{["FAILED", "RETRY"].includes(delivery.status) && <button disabled={!!busy} type="button" onClick={() => request(`/api/company/integrations/deliveries/${delivery.id}/retry`, { method: "POST", body: "{}" })}>Повторить</button>}</span></div>)}</div> : <p className="integration-empty">События появятся после первой отправки.</p>}</section>
    <section className="integration-panel integration-api-reference"><header><div><h2>API v1</h2><p>Короткая памятка для подключения внешней CRM.</p></div></header><div><article><strong>Проверка ключа</strong><code data-no-translate>GET /api/integrations/v1/ping</code></article><article><strong>Программы и задания</strong><code data-no-translate>GET /api/integrations/v1/programs</code></article><article><strong>Агенты</strong><code data-no-translate>GET /api/integrations/v1/agents</code></article><article><strong>Новая заявка</strong><code data-no-translate>POST /api/integrations/v1/leads</code><small>Обязателен заголовок Idempotency-Key.</small></article></div><p>Передавайте ключ в заголовке Authorization: Bearer. Webhook подписан HMAC SHA-256 в заголовке x-risestaff-signature.</p></section>
  </div>;
}
