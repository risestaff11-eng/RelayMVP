import { getD1 } from "../db";

/** A transfer/its correction is an explicit command, never a side effect of a lead edit. */
export async function recordRewardTransfer(companyId: string, rewardId: string, paid: boolean) {
  const db = getD1();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
      SELECT ?, s.id, s.status, s.status, 'COMPANY', ?, ? FROM rewards r JOIN submissions s ON s.id = r.submission_id
      WHERE r.id = ? AND r.company_id = ? AND r.status = ? AND r.partner_confirmed_at IS NULL RETURNING submission_id`)
      .bind(eventId, paid ? "Компания отметила перевод" : "Компания отменила отметку перевода: получение не подтверждено", now, rewardId, companyId, paid ? "APPROVED" : "PAID"),
    db.prepare(`UPDATE rewards SET status = ?, paid_at = ?, updated_at = ? WHERE id = ?
      AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(paid ? "PAID" : "APPROVED", paid ? now : null, now, rewardId, eventId),
  ]);
  return results[0].results[0] as { submission_id: string } | undefined;
}

export async function recordRewardReceipt(partnerId: string, rewardId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const result = await db.batch([
    db.prepare(`INSERT INTO submission_status_events (id, submission_id, from_status, to_status, actor_type, comment, created_at)
      SELECT ?, s.id, s.status, s.status, 'PARTNER', ?, ? FROM rewards r JOIN submissions s ON s.id = r.submission_id
      WHERE r.id = ? AND r.partner_id = ? AND r.status = 'PAID' AND r.partner_confirmed_at IS NULL RETURNING submission_id`)
      .bind(eventId, "Амбассадор подтвердил получение", now, rewardId, partnerId),
    db.prepare(`UPDATE rewards SET partner_confirmed_at = ?, updated_at = ? WHERE id = ?
      AND EXISTS (SELECT 1 FROM submission_status_events WHERE id = ?)`)
      .bind(now, now, rewardId, eventId),
  ]);
  return result[0].results.length ? now : null;
}
