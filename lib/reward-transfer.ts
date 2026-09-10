import { getD1 } from "../db";

/** A transfer/its correction is an explicit command, never a side effect of a lead edit. */
export async function recordRewardTransfer(companyId: string, rewardId: string, paid: boolean) {
  const db = getD1();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const integrationEventId = crypto.randomUUID();
  const integrationIdempotencyKey = `reward.updated:${rewardId}:${now}`;
  const results = await db.batch([
    db.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
      SELECT ?, s.id, s.status, s.status, 'COMPANY', ?, ? FROM rewards r JOIN submissions s ON s.id = r.submission_id
      WHERE r.id = ? AND r.company_id = ? AND r.status = ? AND r.partner_confirmed_at IS NULL RETURNING submission_id`)
      .bind(eventId, paid ? "Компания отметила перевод" : "Компания отменила отметку перевода: получение не подтверждено", now, rewardId, companyId, paid ? "APPROVED" : "PAID"),
    db.prepare(`UPDATE rewards SET status = ?, paid_at = ?, updated_at = ? WHERE id = ?
      AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(paid ? "PAID" : "APPROVED", paid ? now : null, now, rewardId, eventId),
    db.prepare(`INSERT OR IGNORE INTO integration_events
      (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at)
      SELECT ?, r.company_id, 'reward.updated', 'reward', r.id,
        json_object('rewardId', r.id, 'submissionId', r.submission_id, 'partnerId', r.partner_id, 'amount', r.amount,
          'currency', r.currency, 'status', r.status, 'paidAt', r.paid_at, 'partnerConfirmedAt', r.partner_confirmed_at, 'updatedAt', r.updated_at),
        ?, ? FROM rewards r WHERE r.id = ? AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(integrationEventId, integrationIdempotencyKey, now, rewardId, eventId),
  ]);
  const changed = results[0].results[0] as { submission_id: string } | undefined;
  return changed ? { ...changed, integrationIdempotencyKey } : undefined;
}

export async function recordRewardReceipt(partnerId: string, rewardId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const integrationIdempotencyKey = `reward.received:${rewardId}:${now}`;
  const result = await db.batch([
    db.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
      SELECT ?, s.id, s.status, s.status, 'PARTNER', ?, ? FROM rewards r JOIN submissions s ON s.id = r.submission_id
      WHERE r.id = ? AND r.partner_id = ? AND r.status = 'PAID' AND r.partner_confirmed_at IS NULL RETURNING submission_id`)
      .bind(eventId, "Амбассадор подтвердил получение", now, rewardId, partnerId),
    db.prepare(`UPDATE rewards SET partner_confirmed_at = ?, updated_at = ? WHERE id = ?
      AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(now, now, rewardId, eventId),
    db.prepare(`INSERT OR IGNORE INTO integration_events
      (id, company_id, event_type, aggregate_type, aggregate_id, payload_json, idempotency_key, created_at)
      SELECT ?, r.company_id, 'reward.updated', 'reward', r.id,
        json_object('rewardId', r.id, 'submissionId', r.submission_id, 'partnerId', r.partner_id, 'amount', r.amount,
          'currency', r.currency, 'status', 'RECEIVED', 'paidAt', r.paid_at, 'partnerConfirmedAt', r.partner_confirmed_at, 'updatedAt', r.updated_at),
        ?, ? FROM rewards r WHERE r.id = ? AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(crypto.randomUUID(), integrationIdempotencyKey, now, rewardId, eventId),
  ]);
  return result[0].results.length ? now : null;
}
