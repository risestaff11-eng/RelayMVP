import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../../db/company";
import { getD1 } from "../../../../../db";
import { companyPermissionDenied, hasCompanyPermission } from "../../../../../lib/company-permissions";
import { deferIntegrationEvent, recordIntegrationEvent } from "../../../../../lib/integrations/service";
import { notifyAgentWorkChanges } from "../../../../../lib/agent-work-notifications";
import { cleanString, sameOrigin } from "../../../company/_utils";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (!hasCompanyPermission(company.role, "PAYOUTS_MANAGE")) return companyPermissionDenied();
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Проверьте данные корректировки" }, { status: 400 });
  const amount = Number(body.amount);
  const reason = cleanString(body.reason, 500);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000) return Response.json({ error: "Укажите корректную новую сумму" }, { status: 400 });
  if (reason.length < 5) return Response.json({ error: "Укажите причину корректировки" }, { status: 400 });
  const db = getD1();
  const current = await db.prepare(`SELECT id, submission_id AS submissionId, partner_id AS partnerId,
    amount, currency, status, paid_at AS paidAt, partner_confirmed_at AS partnerConfirmedAt, updated_at AS updatedAt
    FROM rewards WHERE id = ? AND company_id = ?`).bind(id, company.id).first<Record<string, unknown>>();
  if (!current) return Response.json({ error: "Начисление не найдено" }, { status: 404 });
  if (current.status === "PAID" || current.paidAt || current.partnerConfirmedAt) {
    return Response.json({ error: "Перевод уже отмечен. Сначала отмените отметку перевода; подтверждённое агентом получение не изменяется задним числом." }, { status: 409 });
  }
  if (!["PENDING", "APPROVED"].includes(String(current.status))) return Response.json({ error: "Это начисление нельзя корректировать в текущем статусе" }, { status: 409 });
  if (Number(current.amount) === amount) return Response.json({ ok: true, amount, unchanged: true });
  const adjustmentId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const integrationIdempotencyKey = `reward.adjusted:${adjustmentId}`;
  const now = new Date().toISOString();
  const difference = amount - Number(current.amount);
  const saved = await db.batch([
    db.prepare(`INSERT INTO reward_adjustments (id, reward_id, company_id, actor_user_id, previous_amount, amount, difference, reason, created_at)
      SELECT ?, id, company_id, ?, amount, ?, ?, ?, ? FROM rewards
      WHERE id = ? AND company_id = ? AND updated_at = ? AND status IN ('PENDING', 'APPROVED') AND paid_at IS NULL AND partner_confirmed_at IS NULL RETURNING id`)
      .bind(adjustmentId, user.userId, amount, difference, reason, now, id, company.id, String(current.updatedAt)),
    db.prepare("UPDATE rewards SET amount = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM reward_adjustments WHERE id = ?)").bind(amount, now, id, adjustmentId),
    db.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
      SELECT ?, s.id, s.status, s.status, 'COMPANY', ?, ? FROM rewards r JOIN submissions s ON s.id = r.submission_id
      WHERE r.id = ? AND EXISTS (SELECT 1 FROM reward_adjustments WHERE id = ?)`)
      .bind(eventId, `Вознаграждение скорректировано: ${current.amount} → ${amount} ${current.currency}. ${reason}`, now, id, adjustmentId),
    db.prepare(`INSERT INTO integration_events (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at)
      SELECT ?, ?, 'reward.updated', 'reward', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM reward_adjustments WHERE id = ?)`)
      .bind(crypto.randomUUID(), company.id, id, JSON.stringify({ rewardId: id, submissionId: current.submissionId, partnerId: current.partnerId, amount, previousAmount: current.amount, difference, currency: current.currency, status: current.status, adjustmentReason: reason, updatedAt: now }), integrationIdempotencyKey, now, adjustmentId),
  ]);
  if (!saved[0].results.length) return Response.json({ error: "Начисление уже изменилось. Обновите страницу и повторите." }, { status: 409 });
  await deferIntegrationEvent(recordIntegrationEvent({ companyId: company.id, eventType: "reward.updated", aggregateType: "reward", aggregateId: id, idempotencyKey: integrationIdempotencyKey, payload: { rewardId: id, submissionId: current.submissionId, partnerId: current.partnerId, amount, previousAmount: current.amount, difference, currency: current.currency, status: current.status, adjustmentReason: reason, updatedAt: now } }));
  await notifyAgentWorkChanges(company.id, [String(current.submissionId)]);
  return Response.json({ ok: true, amount, difference, adjustmentId });
}
