import { getD1 } from "../../db";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./crypto";
import { AmoError, amoRequest, amoStage, inspectAmo, type AmoConfig } from "./amocrm-client";
import { companySubscription } from "../company-subscription";
import { subscriptionAllows } from "../subscription-plans";

const now = () => new Date().toISOString();
type Connection = { id: string; company_id: string; status: string; config_json: string; encrypted_credentials: string };
type Link = { id: string; external_id: string; local_id: string; updated_at: string };
type Lead = { id: number; pipeline_id: number; status_id: number; price: number; custom_fields_values?: Array<{ field_id: number; values: Array<{ value: unknown }> }> };

async function fieldId(url: string, token: string, code: string, name: string, type: string) {
  // Follow pages by constructing our own URL, never by trusting a remote _links URL.
  for (let page = 1; page <= 40; page++) {
    const result = await amoRequest<{ _embedded?: { custom_fields: Array<{ id: number; code: string; type: string }> }; _links?: { next?: unknown } }>(url, token, `/api/v4/leads/custom_fields?limit=250&page=${page}`);
    const field = result._embedded?.custom_fields.find(f => f.code === code);
    if (field) {
      if (field.type !== type) throw new Error("Поле RiseStaff в amoCRM имеет неподходящий тип");
      return field.id;
    }
    if (!result._links?.next) {
      const created = await amoRequest<{ _embedded?: { custom_fields: Array<{ id: number }> } }>(url, token, "/api/v4/leads/custom_fields", "POST", [{ name, type, code }]);
      const id = created._embedded?.custom_fields[0]?.id;
      if (!Number.isSafeInteger(id)) throw new Error("Не удалось подготовить поля RiseStaff в amoCRM");
      return id!;
    }
  }
  throw new Error("В amoCRM слишком много полей. Нужна помощь с настройкой.");
}

export async function connectAmo(companyId: string, input: Record<string, unknown>) {
  const inspected = await inspectAmo({ url: input.url, token: input.token });
  const pipeline = inspected.pipelines.find(p => p.id === Number(input.pipelineId));
  const initial = pipeline?._embedded.statuses.find(s => s.id === Number(input.initialStatusId));
  if (!pipeline || !initial || [142, 143].includes(initial.id)) throw new Error("Выберите воронку и начальный этап amoCRM");
  const currency = inspected.currency || String(input.currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Укажите валюту аккаунта amoCRM");
  const stages = input.stageMap && typeof input.stageMap === "object" ? input.stageMap as Record<string, unknown> : {};
  const stageMap: AmoConfig["stageMap"] = {};
  for (const [id, value] of Object.entries(stages)) {
    if (!pipeline._embedded.statuses.some(s => String(s.id) === id) || !["REVIEWING", "IN_PROGRESS", "AGREEMENT", "LOST"].includes(String(value))) throw new Error("Проверьте сопоставление этапов amoCRM");
    stageMap[id] = value as AmoConfig["stageMap"][string];
  }
  const paidStatusId = input.paidStatusId ? Number(input.paidStatusId) : null;
  if (paidStatusId && (!pipeline._embedded.statuses.some(s => s.id === paidStatusId) || paidStatusId === 143 || paidStatusId === initial.id || input.confirmFullPayment !== true)) throw new Error("Подтвердите, что выбранный этап означает полную оплату клиентом");
  const token = String(input.token).trim();
  const encrypted = await encryptIntegrationSecret(token);
  const existing = await getD1().prepare("SELECT id, config_json FROM integration_connections WHERE company_id = ? AND provider = 'AMOCRM' LIMIT 1").bind(companyId).first<{ id: string; config_json: string }>();
  if (existing) throw new Error("amoCRM уже подключена. Используйте обновление токена или паузу.");
  const markerFieldId = await fieldId(inspected.url, token, "RISESTAFF_ID", "RiseStaff: заявка", "text");
  const contextFieldId = await fieldId(inspected.url, token, "RISESTAFF_CONTEXT", "RiseStaff: источник и условия", "textarea");
  const config: AmoConfig = { url: inspected.url, accountId: inspected.accountId, pipelineId: pipeline.id, initialStatusId: initial.id, markerFieldId, contextFieldId, currency, paidStatusId, stageMap, eventTypes: ["submission.created"], startsAt: now() };
  const id = crypto.randomUUID();
  // Start paused: checking credentials never starts a historical export.
  const saved = await getD1().prepare("INSERT INTO integration_connections (id, company_id, provider, name, status, direction, config_json, encrypted_credentials, created_at, updated_at) SELECT ?, ?, 'AMOCRM', ?, 'PAUSED', 'BIDIRECTIONAL', ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM integration_connections WHERE company_id = ? AND provider = 'AMOCRM')")
    .bind(id, companyId, `amoCRM · ${inspected.accountName}`, JSON.stringify(config), encrypted, config.startsAt, config.startsAt, companyId).run();
  if (!saved.meta.changes) throw new Error("amoCRM уже подключена. Используйте обновление токена или паузу.");
  return { id };
}

export async function amoConnection(companyId: string, id: string, active = true) {
  const connection = await getD1().prepare("SELECT * FROM integration_connections WHERE company_id = ? AND id = ? AND provider = 'AMOCRM'").bind(companyId, id).first<Connection>();
  if (!connection || (active && connection.status !== "ACTIVE")) throw new Error("Активное подключение amoCRM не найдено");
  return connection;
}

export async function updateAmo(companyId: string, id: string, input: Record<string, unknown>) {
  const c = await amoConnection(companyId, id, false);
  const config = JSON.parse(c.config_json) as AmoConfig;
  if (input.token !== undefined) {
    const inspected = await inspectAmo({ url: config.url, token: input.token });
    if (inspected.accountId !== config.accountId) throw new Error("Токен принадлежит другому аккаунту amoCRM");
    await getD1().prepare("UPDATE integration_connections SET encrypted_credentials = ?, last_error = '', updated_at = ? WHERE id = ? AND company_id = ?").bind(await encryptIntegrationSecret(String(input.token).trim()), now(), id, companyId).run();
  }
  if (input.status !== undefined) {
    if (!["ACTIVE", "PAUSED"].includes(String(input.status))) throw new Error("Некорректный статус подключения");
    await getD1().prepare("UPDATE integration_connections SET status = ?, updated_at = ? WHERE id = ? AND company_id = ?").bind(input.status, now(), id, companyId).run();
  }
}

export async function deliverAmo(companyId: string, connectionId: string, submissionId: string) {
  const db = getD1();
  const c = await amoConnection(companyId, connectionId);
  const config = JSON.parse(c.config_json) as AmoConfig;
  const lead = await db.prepare(`SELECT s.*, p.name AS programName, p.currency, m.title AS missionTitle, a.name AS partnerName, a.phone AS partnerPhone FROM submissions s JOIN programs p ON p.id = s.program_id AND p.company_id = s.company_id JOIN missions m ON m.id = s.mission_id JOIN partners a ON a.id = s.partner_id AND a.company_id = s.company_id WHERE s.id = ? AND s.company_id = ?`).bind(submissionId, companyId).first<Record<string, string | number>>();
  if (!lead) throw new Error("Заявка для передачи в amoCRM не найдена");
  if (!["LEAD", "DEAL"].includes(String(lead.type))) return;
  if (lead.currency !== config.currency) throw new Error("Валюты программы и amoCRM различаются. Передача остановлена.");
  const token = await decryptIntegrationSecret(c.encrypted_credentials);
  let link = await db.prepare("SELECT * FROM external_entity_links WHERE company_id = ? AND connection_id = ? AND entity_type = 'submission' AND local_id = ?").bind(companyId, connectionId, submissionId).first<Link>();
  if (link && /^\d+$/.test(link.external_id)) return;
  if (link?.external_id.startsWith("conflict:")) throw new Error("amoCRM объединила заявку с существующей сделкой. Требуется проверка авторства.");
  const marker = `${companyId}:${submissionId}`;
  const query = new URLSearchParams({ [`filter[custom_fields_values][${config.markerFieldId}][]`]: marker, limit: "2" });
  const found = await amoRequest<{ _embedded?: { leads: Lead[] } }>(config.url, token, `/api/v4/leads?${query}`);
  const matches = (found._embedded?.leads || []).filter(l => l.custom_fields_values?.some(f => f.field_id === config.markerFieldId && f.values.some(v => v.value === marker)));
  if (matches.length > 1) throw new Error("В amoCRM найдено несколько сделок одной заявки. Проверьте дубли.");
  let externalId = matches[0]?.id;
  if (!externalId) {
    // Persist creation intent BEFORE the POST. An ambiguous timeout must never
    // create a second deal; retries only reconcile by the stable marker.
    if (link) throw new Error("Исход передачи в amoCRM неизвестен. Повторная попытка проверит существующую сделку.");
    const linkId = crypto.randomUUID();
    await db.prepare("INSERT OR IGNORE INTO external_entity_links (id, company_id, connection_id, entity_type, local_id, external_id, created_at, updated_at) VALUES (?, ?, ?, 'submission', ?, ?, ?, ?)")
      .bind(linkId, companyId, connectionId, submissionId, `pending:${submissionId}`, now(), now()).run();
    link = await db.prepare("SELECT * FROM external_entity_links WHERE company_id = ? AND connection_id = ? AND entity_type = 'submission' AND local_id = ?").bind(companyId, connectionId, submissionId).first<Link>();
    if (link?.id !== linkId) throw new Error("Эта заявка уже передаётся в amoCRM");
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(String(lead.payload_json)); } catch { /* legacy payload */ }
    const context = [`Программа: ${lead.programName}`, `Задание: ${lead.missionTitle}`, `Привёл: ${lead.partnerName}`, `Телефон рекомендателя: ${lead.partnerPhone}`, `Источник: ${String(payload.referralSource || (payload.submittedByClient ? "Реферальная ссылка" : "Рекомендация"))}`, `Комментарий: ${String(payload.partnerComment || "").slice(0, 2400)}`, `RiseStaff: ${submissionId}`].join("\n");
    const fields = [];
    if (lead.contact_phone) fields.push({ field_code: "PHONE", values: [{ value: lead.contact_phone, enum_code: "WORK" }] });
    if (lead.contact_email) fields.push({ field_code: "EMAIL", values: [{ value: lead.contact_email, enum_code: "WORK" }] });
    let result: Array<{ id: number; merged?: boolean }>;
    try { result = await amoRequest<Array<{ id: number; merged?: boolean }>>(config.url, token, "/api/v4/leads/complex", "POST", [{
      name: String(lead.contact_name || lead.contact_company || "Клиент RiseStaff"), pipeline_id: config.pipelineId, status_id: config.initialStatusId,
      price: Number(lead.estimated_deal_amount) || 0,
      custom_fields_values: [{ field_id: config.markerFieldId, values: [{ value: marker }] }, { field_id: config.contextFieldId, values: [{ value: context }] }],
      _embedded: { contacts: [{ name: String(lead.contact_name || lead.contact_company), custom_fields_values: fields }] },
    }]); } catch (error) {
      if (error instanceof AmoError && error.status !== null && error.status >= 400 && error.status < 500) {
        await db.prepare("DELETE FROM external_entity_links WHERE id = ? AND external_id = ?").bind(linkId, `pending:${submissionId}`).run();
      }
      throw error;
    }
    if (result[0]?.merged) {
      await db.prepare("UPDATE external_entity_links SET external_id = ? WHERE id = ?").bind(`conflict:${result[0].id}`, linkId).run();
      throw new Error("amoCRM объединила заявку с существующей сделкой. Требуется проверка авторства.");
    }
    externalId = result[0]?.id;
    if (!Number.isSafeInteger(externalId)) throw new Error("amoCRM не подтвердила создание сделки");
  }
  if (!link) {
    await db.prepare("INSERT OR IGNORE INTO external_entity_links (id, company_id, connection_id, entity_type, local_id, external_id, created_at, updated_at) VALUES (?, ?, ?, 'submission', ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), companyId, connectionId, submissionId, String(externalId), now(), now()).run();
  }
  await db.prepare("UPDATE external_entity_links SET external_id = ?, external_url = ?, last_synced_at = ?, updated_at = ? WHERE company_id = ? AND connection_id = ? AND entity_type = 'submission' AND local_id = ?")
    .bind(String(externalId), `${config.url}/leads/detail/${externalId}`, now(), now(), companyId, connectionId, submissionId).run();
}

export async function syncAmo(companyId: string, connectionId: string) {
  const subscription = await companySubscription(companyId);
  if (!subscription || !subscriptionAllows(subscription, "INTEGRATIONS")) throw new Error("Подключение недоступно на текущем тарифе");
  const db = getD1();
  const c = await amoConnection(companyId, connectionId);
  const config = JSON.parse(c.config_json) as AmoConfig;
  const token = await decryptIntegrationSecret(c.encrypted_credentials);
  const links = await db.prepare("SELECT * FROM external_entity_links WHERE company_id = ? AND connection_id = ? AND entity_type = 'submission' AND external_id NOT LIKE 'pending:%' AND external_id NOT LIKE 'conflict:%' ORDER BY COALESCE(last_synced_at, '') LIMIT 10").bind(companyId, connectionId).all<Link>();
  const { applySubmissionUpdate } = await import("../../app/api/submissions/[id]/route");
  const errors: string[] = [];
  let updated = 0;
  for (const link of links.results) {
    try {
      if (!/^\d+$/.test(link.external_id)) continue;
      const external = await amoRequest<Lead>(config.url, token, `/api/v4/leads/${link.external_id}`);
      if (external.pipeline_id !== config.pipelineId) throw new Error("Сделка перемещена в другую воронку. Проверьте сопоставление.");
      const marker = `${companyId}:${link.local_id}`;
      if (!external.custom_fields_values?.some(f => f.field_id === config.markerFieldId && f.values.some(v => v.value === marker))) throw new Error("В amoCRM изменён источник заявки. Автоматическое обновление остановлено.");
      const next = amoStage(config, external.status_id, external.price);
      const local = await db.prepare("SELECT s.review_status, s.sales_status, s.ownership_status, s.deal_amount, p.currency FROM submissions s JOIN programs p ON p.id = s.program_id WHERE s.id = ? AND s.company_id = ?").bind(link.local_id, companyId).first<{ review_status: string; sales_status: string; ownership_status: string; deal_amount: number; currency: string }>();
      if (!local || local.currency !== config.currency) throw new Error("Проверьте валюту программы перед синхронизацией amoCRM");
      if (next && (local.ownership_status !== "CLEAR" || local.review_status === "REJECTED")) throw new Error("Заявка отклонена или авторство спорное. Требуется решение компании.");
      if (next && (next.reviewStatus !== local.review_status || next.salesStatus !== local.sales_status || ("dealAmount" in next && next.dealAmount !== local.deal_amount))) {
        const result = await applySubmissionUpdate({ id: companyId }, link.local_id, next, "INTEGRATION_AMOCRM");
        if (!result.ok) { const body = await result.json() as { error: string }; throw new Error(body.error); }
        updated++;
      }
    } catch (error) { errors.push(error instanceof Error ? error.message : "Ошибка синхронизации amoCRM"); }
    await db.prepare("UPDATE external_entity_links SET last_synced_at = ?, updated_at = ? WHERE id = ? AND company_id = ?").bind(now(), now(), link.id, companyId).run();
  }
  await db.prepare("UPDATE integration_connections SET last_success_at = CASE WHEN ? = '' THEN ? ELSE last_success_at END, last_error = ?, last_error_at = CASE WHEN ? <> '' THEN ? ELSE last_error_at END WHERE id = ? AND company_id = ?")
    .bind(errors[0] || "", now(), errors[0] || "", errors[0] || "", now(), connectionId, companyId).run();
  return { checked: links.results.length, updated, errors };
}

export async function drainAmoSync() {
  const rows = await getD1().prepare("SELECT id, company_id FROM integration_connections WHERE provider = 'AMOCRM' AND status = 'ACTIVE' ORDER BY MAX(COALESCE(last_success_at, ''), COALESCE(last_error_at, '')) LIMIT 5").all<{ id: string; company_id: string }>();
  for (const row of rows.results) {
    try { await syncAmo(row.company_id, row.id); }
    catch { await getD1().prepare("UPDATE integration_connections SET last_error_at = ?, last_error = ? WHERE id = ?").bind(now(), "Не удалось проверить этапы amoCRM. Обновите доступ или повторите позже.", row.id).run(); }
  }
}
