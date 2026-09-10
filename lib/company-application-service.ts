import { getD1 } from "../db";
import { sendCompanyApplicationNotification } from "./agent-email";

type ApplicationNotificationRow = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  comment: string;
  notificationAttempts: number;
};

function nextAttempt(attempt: number) {
  const minutes = [1, 5, 30, 120][Math.max(0, Math.min(attempt - 1, 3))];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function deliverCompanyApplicationNotification(applicationId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const claimed = await db.prepare(`UPDATE company_applications
    SET notification_status = 'PROCESSING', updated_at = ?
    WHERE id = ? AND notification_attempts < 5 AND notification_status IN ('PENDING', 'FAILED')
      AND (next_notification_at IS NULL OR next_notification_at <= ?)`)
    .bind(now, applicationId, now).run();
  if (!claimed.meta.changes) return false;
  const application = await db.prepare(`SELECT id, name, company, email, phone, comment,
    notification_attempts AS notificationAttempts FROM company_applications WHERE id = ?`)
    .bind(applicationId).first<ApplicationNotificationRow>();
  if (!application) return false;
  try {
    await sendCompanyApplicationNotification(application);
    await db.prepare(`UPDATE company_applications SET notification_status = 'SENT',
      notification_attempts = notification_attempts + 1, next_notification_at = NULL,
      notified_at = ?, last_error = '', updated_at = ? WHERE id = ?`)
      .bind(now, now, applicationId).run();
    return true;
  } catch (error) {
    const attempt = Number(application.notificationAttempts || 0) + 1;
    const message = error instanceof Error ? error.message.slice(0, 500) : "Ошибка отправки";
    await db.prepare(`UPDATE company_applications SET notification_status = 'FAILED',
      notification_attempts = ?, next_notification_at = ?, last_error = ?, updated_at = ? WHERE id = ?`)
      .bind(attempt, attempt >= 5 ? null : nextAttempt(attempt), message, now, applicationId).run();
    return false;
  }
}

export async function drainCompanyApplicationNotifications(limit = 10) {
  const db = getD1();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  await db.prepare(`UPDATE company_applications SET notification_status = 'FAILED',
    next_notification_at = ?, last_error = 'Предыдущая попытка прервалась', updated_at = ?
    WHERE notification_status = 'PROCESSING' AND updated_at <= ?`)
    .bind(now, now, staleBefore).run();
  const rows = await db.prepare(`SELECT id FROM company_applications
    WHERE notification_attempts < 5 AND notification_status IN ('PENDING', 'FAILED')
      AND (next_notification_at IS NULL OR next_notification_at <= ?)
    ORDER BY created_at LIMIT ?`).bind(now, Math.max(1, Math.min(25, limit))).all<{ id: string }>();
  for (const row of rows.results) await deliverCompanyApplicationNotification(row.id);
}
