import { getD1 } from "../../db";
import { waitUntil } from "cloudflare:workers";
import { decryptIntegrationSecret, encryptIntegrationSecret, randomToken, sha256, signWebhook } from "./crypto";
import { normalizeWebhookUrl } from "./url";

export const INTEGRATION_EVENT_TYPES = [
  "submission.created",
  "submission.updated",
  "reward.updated",
  "integration.test",
] as const;
export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number];

export const API_KEY_SCOPES = ["integrations:read", "programs:read", "agents:read", "leads:write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

type WebhookConfig = { url: string; eventTypes: IntegrationEventType[]; timeoutMs: number };
export type IntegrationOverview = {
  connections: Array<{ id: string; name: string; status: string; lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string; config: { url: string; eventTypes: string[] } }>;
  deliveries: Array<{ id: string; status: string; attemptCount: number; responseStatus: number | null; lastError: string; deliveredAt: string | null; createdAt: string; eventType: string; aggregateType: string; aggregateId: string; connectionName: string }>;
  apiKeys: Array<{ id: string; name: string; tokenPrefix: string; scopes: string[]; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string }>;
};

function json<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function isoNow() { return new Date().toISOString(); }

function retryAt(attempt: number) {
  const minutes = [1, 5, 30, 120][Math.max(0, Math.min(attempt - 1, 3))];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function getIntegrationOverview(companyId: string): Promise<IntegrationOverview> {
  const db = getD1();
  const [connections, deliveries, keys] = await Promise.all([
    db.prepare("SELECT id, name, status, config_json AS configJson, last_success_at AS lastSuccessAt, last_error_at AS lastErrorAt, last_error AS lastError FROM integration_connections WHERE company_id = ? ORDER BY created_at DESC").bind(companyId).all<{ id: string; name: string; status: string; configJson: string; lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string }>(),
    db.prepare("SELECT d.id, d.status, d.attempt_count AS attemptCount, d.response_status AS responseStatus, d.last_error AS lastError, d.delivered_at AS deliveredAt, d.created_at AS createdAt, e.event_type AS eventType, e.aggregate_type AS aggregateType, e.aggregate_id AS aggregateId, c.name AS connectionName FROM integration_deliveries d JOIN integration_events e ON e.id = d.event_id JOIN integration_connections c ON c.id = d.connection_id WHERE e.company_id = ? ORDER BY d.created_at DESC LIMIT 50").bind(companyId).all<IntegrationOverview["deliveries"][number]>(),
    db.prepare("SELECT id, name, token_prefix AS tokenPrefix, scopes_json AS scopesJson, last_used_at AS lastUsedAt, expires_at AS expiresAt, revoked_at AS revokedAt, created_at AS createdAt FROM integration_api_keys WHERE company_id = ? ORDER BY created_at DESC").bind(companyId).all<{ id: string; name: string; tokenPrefix: string; scopesJson: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string }>(),
  ]);
  return {
    connections: connections.results.map(({ configJson, ...item }) => ({ ...item, config: json<{ url: string; eventTypes: string[] }>(configJson, { url: "", eventTypes: [] }) })),
    deliveries: deliveries.results,
    apiKeys: keys.results.map(({ scopesJson, ...item }) => ({ ...item, scopes: json<string[]>(scopesJson, []) })),
  };
}

export async function createWebhookConnection(companyId: string, input: { name: unknown; url: unknown; eventTypes: unknown }) {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Укажите название подключения");
  const url = normalizeWebhookUrl(input.url);
  const requested = Array.isArray(input.eventTypes) ? input.eventTypes.map(String) : [];
  const eventTypes = INTEGRATION_EVENT_TYPES.filter((event) => event !== "integration.test" && requested.includes(event));
  if (!eventTypes.length) throw new Error("Выберите хотя бы одно событие");
  const id = crypto.randomUUID();
  const signingSecret = `rswhsec_${randomToken(32)}`;
  await getD1().prepare("INSERT INTO integration_connections (id, company_id, provider, name, status, direction, config_json, encrypted_credentials, created_at, updated_at) VALUES (?, ?, 'WEBHOOK', ?, 'ACTIVE', 'OUTBOUND', ?, ?, ?, ?)")
    .bind(id, companyId, name, JSON.stringify({ url, eventTypes, timeoutMs: 8_000 }), await encryptIntegrationSecret(signingSecret), isoNow(), isoNow()).run();
  return { id, name, status: "ACTIVE", config: { url, eventTypes }, signingSecret };
}

export async function updateWebhookConnection(companyId: string, connectionId: string, input: { status?: unknown; name?: unknown; url?: unknown; eventTypes?: unknown }) {
  const current = await getD1().prepare("SELECT id, name, status, config_json AS configJson FROM integration_connections WHERE id = ? AND company_id = ? AND provider = 'WEBHOOK'").bind(connectionId, companyId).first<Record<string, string>>();
  if (!current) throw new Error("Подключение не найдено");
  const existing = json<WebhookConfig>(current.configJson, { url: "", eventTypes: [], timeoutMs: 8_000 });
  const status = input.status === "PAUSED" ? "PAUSED" : input.status === "ACTIVE" ? "ACTIVE" : current.status;
  const name = input.name === undefined ? current.name : String(input.name).trim().slice(0, 80);
  const url = input.url === undefined ? existing.url : normalizeWebhookUrl(input.url);
  const requested = input.eventTypes === undefined ? existing.eventTypes : Array.isArray(input.eventTypes) ? input.eventTypes.map(String) : [];
  const eventTypes = INTEGRATION_EVENT_TYPES.filter((event) => event !== "integration.test" && requested.includes(event));
  if (!name || !eventTypes.length) throw new Error("Проверьте название и список событий");
  const config = { url, eventTypes, timeoutMs: 8_000 };
  await getD1().prepare("UPDATE integration_connections SET name = ?, status = ?, config_json = ?, updated_at = ? WHERE id = ? AND company_id = ?")
    .bind(name, status, JSON.stringify(config), isoNow(), connectionId, companyId).run();
  return { id: connectionId, name, status, config };
}

export async function createApiKey(companyId: string, input: { name: unknown; scopes: unknown }) {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Укажите название ключа");
  const requested = Array.isArray(input.scopes) ? input.scopes.map(String) : [];
  const scopes = API_KEY_SCOPES.filter((scope) => requested.includes(scope));
  if (!scopes.length) throw new Error("Выберите хотя бы одно разрешение");
  const token = `rsk_live_${randomToken(36)}`;
  const id = crypto.randomUUID();
  await getD1().prepare("INSERT INTO integration_api_keys (id, company_id, name, token_prefix, token_hash, scopes_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, companyId, name, token.slice(0, 18), await sha256(token), JSON.stringify(scopes), isoNow()).run();
  return { id, name, token, tokenPrefix: token.slice(0, 18), scopes };
}

export async function revokeApiKey(companyId: string, keyId: string) {
  const result = await getD1().prepare("UPDATE integration_api_keys SET revoked_at = ? WHERE id = ? AND company_id = ? AND revoked_at IS NULL").bind(isoNow(), keyId, companyId).run();
  if (!result.meta.changes) throw new Error("Активный ключ не найден");
}

export async function authenticateApiKey(request: Request, requiredScope: ApiKeyScope) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("rsk_live_")) return null;
  const row = await getD1().prepare("SELECT id, company_id AS companyId, scopes_json AS scopesJson, expires_at AS expiresAt, revoked_at AS revokedAt FROM integration_api_keys WHERE token_hash = ?").bind(await sha256(token)).first<Record<string, string | null>>();
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= isoNow())) return null;
  const scopes = json<string[]>(row.scopesJson, []);
  if (!scopes.includes(requiredScope)) return null;
  await getD1().prepare("UPDATE integration_api_keys SET last_used_at = ? WHERE id = ?").bind(isoNow(), row.id).run();
  return { keyId: String(row.id), companyId: String(row.companyId), scopes };
}

export async function recordIntegrationEvent(input: { companyId: string; eventType: IntegrationEventType; aggregateType: string; aggregateId: string; payload: Record<string, unknown>; idempotencyKey?: string }) {
  const db = getD1();
  const idempotencyKey = input.idempotencyKey || `${input.eventType}:${input.aggregateId}:${randomToken(8)}`;
  const existing = await db.prepare("SELECT id FROM integration_events WHERE idempotency_key = ?").bind(idempotencyKey).first<{ id: string }>();
  let eventId = existing?.id;
  if (!eventId) {
    eventId = crypto.randomUUID();
    await db.prepare("INSERT OR IGNORE INTO integration_events (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(eventId, input.companyId, input.eventType, input.aggregateType, input.aggregateId, JSON.stringify(input.payload), idempotencyKey, isoNow()).run();
    const stored = await db.prepare("SELECT id FROM integration_events WHERE idempotency_key = ?").bind(idempotencyKey).first<{ id: string }>();
    eventId = stored?.id || eventId;
  }
  const connections = await db.prepare("SELECT id, config_json AS configJson FROM integration_connections WHERE company_id = ? AND provider = 'WEBHOOK' AND status = 'ACTIVE'").bind(input.companyId).all<{ id: string; configJson: string }>();
  for (const connection of connections.results) {
    const config = json<WebhookConfig>(connection.configJson, { url: "", eventTypes: [], timeoutMs: 8_000 });
    if (input.eventType !== "integration.test" && !config.eventTypes.includes(input.eventType)) continue;
    await db.prepare("INSERT OR IGNORE INTO integration_deliveries (id, event_id, connection_id, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, 'PENDING', 0, ?, ?, ?)")
      .bind(crypto.randomUUID(), eventId, connection.id, isoNow(), isoNow(), isoNow()).run();
  }
  await dispatchPendingDeliveries(input.companyId);
  return { eventId };
}

export async function testWebhookConnection(companyId: string, connectionId: string) {
  const connection = await getD1().prepare("SELECT id FROM integration_connections WHERE id = ? AND company_id = ? AND provider = 'WEBHOOK'").bind(connectionId, companyId).first<{ id: string }>();
  if (!connection) throw new Error("Подключение не найдено");
  const eventId = crypto.randomUUID();
  const now = isoNow();
  const db = getD1();
  await db.batch([
    db.prepare("INSERT INTO integration_events (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at) VALUES (?, ?, 'integration.test', 'connection', ?, ?, ?, ?)").bind(eventId, companyId, connectionId, JSON.stringify({ message: "Проверка webhook из RiseStaff" }), `integration.test:${eventId}`, now),
    db.prepare("INSERT INTO integration_deliveries (id, event_id, connection_id, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, 'PENDING', 0, ?, ?, ?)").bind(crypto.randomUUID(), eventId, connectionId, now, now, now),
  ]);
  await dispatchPendingDeliveries(companyId);
}

export async function retryDelivery(companyId: string, deliveryId: string) {
  const result = await getD1().prepare("UPDATE integration_deliveries SET status = 'PENDING', next_attempt_at = ?, last_error = '', updated_at = ? WHERE id = ? AND connection_id IN (SELECT id FROM integration_connections WHERE company_id = ?)").bind(isoNow(), isoNow(), deliveryId, companyId).run();
  if (!result.meta.changes) throw new Error("Доставка не найдена");
  await dispatchPendingDeliveries(companyId, deliveryId);
}

export async function dispatchPendingDeliveries(companyId: string, onlyDeliveryId?: string) {
  const db = getD1();
  const rows = await db.prepare(`SELECT d.id, d.attempt_count AS attemptCount, e.id AS eventId, e.event_type AS eventType, e.aggregate_type AS aggregateType, e.aggregate_id AS aggregateId, e.payload_json AS payloadJson, e.created_at AS eventCreatedAt, c.id AS connectionId, c.config_json AS configJson, c.encrypted_credentials AS encryptedCredentials FROM integration_deliveries d JOIN integration_events e ON e.id = d.event_id JOIN integration_connections c ON c.id = d.connection_id WHERE e.company_id = ? AND c.status = 'ACTIVE' AND d.status IN ('PENDING','RETRY') AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?) AND (? IS NULL OR d.id = ?) ORDER BY d.created_at LIMIT 20`)
    .bind(companyId, isoNow(), onlyDeliveryId || null, onlyDeliveryId || null).all<Record<string, unknown>>();
  for (const row of rows.results) {
    const claimed = await db.prepare("UPDATE integration_deliveries SET status = 'PROCESSING', updated_at = ? WHERE id = ? AND status IN ('PENDING','RETRY')").bind(isoNow(), row.id).run();
    if (!claimed.meta.changes) continue;
    const attempt = Number(row.attemptCount || 0) + 1;
    const config = json<WebhookConfig>(String(row.configJson || ""), { url: "", eventTypes: [], timeoutMs: 8_000 });
    const envelope = {
      id: row.eventId,
      type: row.eventType,
      createdAt: row.eventCreatedAt,
      companyId,
      data: json(String(row.payloadJson || ""), {}),
    };
    const body = JSON.stringify(envelope);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const started = Date.now();
    let responseStatus: number | null = null;
    let error = "";
    try {
      const secret = await decryptIntegrationSecret(String(row.encryptedCredentials || ""));
      const signature = await signWebhook(secret, timestamp, body);
      const response = await fetch(config.url, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/json", "user-agent": "RiseStaff-Webhooks/1.0", "x-risestaff-event": String(row.eventType), "x-risestaff-delivery": String(row.id), "x-risestaff-timestamp": timestamp, "x-risestaff-signature": `v1=${signature}` },
        body,
        signal: AbortSignal.timeout(Math.min(15_000, Math.max(2_000, config.timeoutMs || 8_000))),
      });
      responseStatus = response.status;
      if (!response.ok) error = `HTTP ${response.status}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message.slice(0, 500) : "Ошибка сети";
    }
    const now = isoNow();
    const delivered = !error && responseStatus !== null && responseStatus >= 200 && responseStatus < 300;
    const terminal = !delivered && attempt >= 5;
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO integration_delivery_attempts (id, delivery_id, attempt_number, response_status, error, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), row.id, attempt, responseStatus, error, Date.now() - started, now),
      delivered
        ? db.prepare("UPDATE integration_deliveries SET status = 'DELIVERED', attempt_count = ?, response_status = ?, last_error = '', delivered_at = ?, next_attempt_at = NULL, updated_at = ? WHERE id = ?").bind(attempt, responseStatus, now, now, row.id)
        : db.prepare("UPDATE integration_deliveries SET status = ?, attempt_count = ?, response_status = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?").bind(terminal ? "FAILED" : "RETRY", attempt, responseStatus, error, terminal ? null : retryAt(attempt), now, row.id),
      delivered
        ? db.prepare("UPDATE integration_connections SET last_success_at = ?, last_error = '', updated_at = ? WHERE id = ?").bind(now, now, row.connectionId)
        : db.prepare("UPDATE integration_connections SET last_error_at = ?, last_error = ?, updated_at = ? WHERE id = ?").bind(now, error, now, row.connectionId),
    ]);
  }
}

export function safeIntegrationEvent(promise: Promise<unknown>) {
  return promise.catch((error) => console.warn("Integration event failed", error instanceof Error ? error.message : "unknown error"));
}

export function deferIntegrationEvent(promise: Promise<unknown>) {
  const safe = safeIntegrationEvent(promise);
  if (typeof waitUntil === "function") waitUntil(safe);
  return safe;
}
