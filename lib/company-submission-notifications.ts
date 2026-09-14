import { getD1 } from "../db";
import { sendCompanyNewSubmissionNotification } from "./agent-email";

type SubmissionNotice = Parameters<typeof sendCompanyNewSubmissionNotification>[0];

// Call only after the submission transaction commits. Derive the recipient and
// content from saved tenant-owned records, never from public form parameters.
async function deliver(companyId: string, submissionId: string) {
    const result = await getD1().prepare(`SELECT u.email AS destination, c.name AS companyName,
      p.name AS agentName, m.title AS missionTitle, g.name AS programName,
      s.contact_name AS contactName, s.contact_company AS contactCompany, s.id AS submissionId, s.type
      FROM submissions s
      INNER JOIN companies c ON c.id = s.company_id
      INNER JOIN users u ON u.id = c.owner_user_id
      INNER JOIN programs g ON g.id = s.program_id AND g.company_id = c.id
      INNER JOIN missions m ON m.id = s.mission_id AND m.program_id = g.id
      INNER JOIN partners p ON p.id = s.partner_id AND p.company_id = c.id AND p.program_id = g.id
      WHERE s.company_id = ? AND s.id = ? LIMIT 1`).bind(companyId, submissionId).all<SubmissionNotice>();
    if (!result.success) throw new Error("Notification lookup failed");
    const notice = result.results[0];
    if (!notice) throw new Error("Notification relation unavailable");
    const destination = notice.destination.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) throw new Error("Invalid notification recipient");
    await sendCompanyNewSubmissionNotification({ ...notice, destination });
}

export async function deliverLeadNotification(companyId: string, submissionId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const lease = crypto.randomUUID();
  const claimed = await db.prepare(`UPDATE lead_notification_jobs SET status = 'PROCESSING',
    attempts = attempts + 1, lease_token = ?, lease_until = ?
    WHERE submission_id = ? AND company_id = ? AND attempts < 6 AND status IN ('PENDING','RETRY')
    AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`)
    .bind(lease, new Date(Date.now() + 300000).toISOString(), submissionId, companyId, now).run();
  if (!claimed.meta.changes) return;
  try {
    await deliver(companyId, submissionId);
    await db.prepare("UPDATE lead_notification_jobs SET status = 'SENT', sent_at = ?, last_error = '', lease_token = NULL, lease_until = NULL WHERE submission_id = ? AND lease_token = ?")
      .bind(new Date().toISOString(), submissionId, lease).run();
  } catch {
    console.error("Company new submission notification failed", { companyId, submissionId });
    const job = await db.prepare("SELECT attempts FROM lead_notification_jobs WHERE submission_id = ? AND lease_token = ?").bind(submissionId, lease).first<{ attempts: number }>();
    if (!job) return;
    const exhausted = job.attempts >= 6;
    const delay = [1, 5, 30, 120, 360][Math.min(4, job.attempts - 1)] * 60000;
    await db.prepare("UPDATE lead_notification_jobs SET status = ?, next_attempt_at = ?, last_error = 'EMAIL_DELIVERY_FAILED', lease_token = NULL, lease_until = NULL WHERE submission_id = ? AND lease_token = ?")
      .bind(exhausted ? "FAILED" : "RETRY", exhausted ? null : new Date(Date.now() + delay).toISOString(), submissionId, lease).run();
  }
}

export async function notifyCompanyNewSubmission(companyId: string, submissionId: string) {
  try {
    // Production inserts this job in the submission transaction via a trigger.
    // This idempotent fallback also supports callers using isolated test schemas.
    await getD1().prepare("INSERT OR IGNORE INTO lead_notification_jobs (submission_id, company_id) SELECT id, company_id FROM submissions WHERE id = ? AND company_id = ?")
      .bind(submissionId, companyId).run();
    await deliverLeadNotification(companyId, submissionId);
  } catch {
    // Even recipient lookup failure must not turn an already saved lead into an
    // error response that invites duplicate submissions. No PII in runtime logs.
    console.error("Company new submission notification failed", { companyId, submissionId });
  }
}

export async function drainLeadNotifications(limit = 5) {
  const db = getD1();
  const now = new Date().toISOString();
  await db.prepare("UPDATE lead_notification_jobs SET status = CASE WHEN attempts >= 6 THEN 'FAILED' ELSE 'RETRY' END, next_attempt_at = ?, lease_token = NULL, lease_until = NULL WHERE status = 'PROCESSING' AND lease_until <= ?").bind(now, now).run();
  const rows = await db.prepare("SELECT submission_id AS submissionId, company_id AS companyId FROM lead_notification_jobs WHERE status IN ('PENDING','RETRY') AND attempts < 6 AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at LIMIT ?")
    .bind(now, Math.max(1, Math.min(10, limit))).all<{ submissionId: string; companyId: string }>();
  await Promise.all(rows.results.map((row) => deliverLeadNotification(row.companyId, row.submissionId)));
}
