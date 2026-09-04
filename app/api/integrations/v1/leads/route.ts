import { getD1 } from "@/db";
import { authenticateApiKey, deferIntegrationEvent, recordIntegrationEvent } from "@/lib/integrations/service";
import { duplicateCutoff, normalizeContactEmail, normalizeContactPhone } from "@/lib/submission-antifraud";
import { reviewDueAt } from "@/lib/workflow";
import { apiError, apiJson } from "../_response";

function text(value: unknown, length: number) { return String(value ?? "").trim().slice(0, length); }

export async function POST(request: Request) {
  const access = await authenticateApiKey(request, "leads:write");
  if (!access) return apiError("Проверьте API-ключ и его разрешения", 401, "UNAUTHORIZED");
  const idempotencyKey = text(request.headers.get("idempotency-key"), 120);
  if (idempotencyKey.length < 8) return apiError("Передайте уникальный Idempotency-Key длиной от 8 символов", 400, "IDEMPOTENCY_KEY_REQUIRED");
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return apiError("Тело запроса должно быть JSON", 400, "INVALID_JSON"); }
  const programId = text(body.programId, 80);
  const missionId = text(body.missionId, 80);
  const partnerId = text(body.partnerId, 80);
  const contactName = text(body.contactName, 160);
  const contactCompany = text(body.contactCompany, 160);
  const contactEmail = normalizeContactEmail(text(body.contactEmail, 240));
  const contactPhone = normalizeContactPhone(text(body.contactPhone, 80));
  const comment = text(body.comment, 2400);
  const estimatedDealAmount = Math.max(0, Math.round(Number(body.estimatedDealAmount) || 0));
  if (!programId || !missionId || !partnerId) return apiError("Укажите programId, missionId и partnerId", 400, "RELATIONS_REQUIRED");
  if (!contactName && !contactCompany) return apiError("Укажите имя клиента или компанию", 400, "CONTACT_REQUIRED");
  if (!contactEmail && !contactPhone) return apiError("Укажите телефон или email клиента", 400, "CONTACT_REQUIRED");
  if (estimatedDealAmount > 1_000_000_000_000) return apiError("Проверьте потенциальную сумму сделки", 400, "INVALID_AMOUNT");
  const db = getD1();
  const target = await db.prepare("SELECT p.id AS programId, p.status AS programStatus, m.id AS missionId, m.type AS missionType, m.status AS missionStatus, a.id AS partnerId, a.status AS partnerStatus FROM programs p JOIN missions m ON m.program_id = p.id JOIN partners a ON a.program_id = p.id AND a.company_id = p.company_id WHERE p.id = ? AND p.company_id = ? AND m.id = ? AND a.id = ?")
    .bind(programId, access.companyId, missionId, partnerId).first<Record<string, string>>();
  if (!target || !["PUBLISHED", "PAUSED"].includes(target.programStatus) || target.missionStatus !== "ACTIVE" || target.partnerStatus !== "ACTIVE") return apiError("Программа, задание или агент недоступны", 404, "RELATION_NOT_FOUND");
  const fullIdempotencyKey = `api:${access.keyId}:${idempotencyKey}`;
  const existing = await db.prepare("SELECT aggregate_id AS aggregateId FROM integration_events WHERE company_id = ? AND idempotency_key = ?").bind(access.companyId, fullIdempotencyKey).first<{ aggregateId: string }>();
  if (existing) return apiJson({ submissionId: existing.aggregateId, duplicateRequest: true });
  const duplicate = await db.prepare("SELECT id FROM submissions WHERE company_id = ? AND created_at >= ? AND review_status <> 'REJECTED' AND ((? <> '' AND contact_email = ?) OR (? <> '' AND contact_phone = ?)) LIMIT 1")
    .bind(access.companyId, duplicateCutoff(), contactEmail, contactEmail, contactPhone, contactPhone).first<{ id: string }>();
  if (duplicate) return apiError("Контакт уже закреплён за другой рекомендацией", 409, "DUPLICATE_CONTACT");
  const submissionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const timelineId = crypto.randomUUID();
  const now = new Date().toISOString();
  const eventPayload = { submissionId, programId, missionId, partnerId, contactName, contactCompany, contactEmail, contactPhone, source: "EXTERNAL_API" };
  const saved = await db.batch([
    db.prepare("INSERT OR IGNORE INTO integration_events (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at) VALUES (?, ?, 'submission.created', 'submission', ?, ?, ?, ?)").bind(eventId, access.companyId, submissionId, JSON.stringify(eventPayload), fullIdempotencyKey, now),
    db.prepare("INSERT INTO submissions (id, company_id, program_id, mission_id, partner_id, type, contact_name, contact_company, contact_email, contact_phone, payload_json, status, review_status, sales_status, ownership_status, review_due_at, estimated_deal_amount, deal_amount, company_comment, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', 'PENDING', 'NONE', 'CLEAR', ?, ?, 0, '', ?, ? WHERE EXISTS (SELECT 1 FROM integration_events WHERE id = ?)").bind(submissionId, access.companyId, programId, missionId, partnerId, target.missionType, contactName, contactCompany, contactEmail, contactPhone, JSON.stringify({ partnerComment: comment, source: "EXTERNAL_API", apiKeyId: access.keyId }), reviewDueAt(now), estimatedDealAmount, now, now, eventId),
    db.prepare("INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at) SELECT ?, ?, NULL, 'SUBMITTED', 'INTEGRATION', ?, ? WHERE EXISTS (SELECT 1 FROM submissions WHERE id = ?)").bind(timelineId, submissionId, "Заявка получена через API", now, submissionId),
  ]);
  if (!saved[0].meta.changes) {
    const raced = await db.prepare("SELECT aggregate_id AS aggregateId FROM integration_events WHERE company_id = ? AND idempotency_key = ?").bind(access.companyId, fullIdempotencyKey).first<{ aggregateId: string }>();
    return apiJson({ submissionId: raced?.aggregateId, duplicateRequest: true });
  }
  deferIntegrationEvent(recordIntegrationEvent({ companyId: access.companyId, eventType: "submission.created", aggregateType: "submission", aggregateId: submissionId, payload: eventPayload, idempotencyKey: fullIdempotencyKey }));
  return apiJson({ submissionId, duplicateRequest: false }, 201);
}
