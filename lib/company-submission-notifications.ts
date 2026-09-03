import { getD1 } from "../db";
import { sendCompanyNewSubmissionNotification } from "./agent-email";

type SubmissionNotice = Parameters<typeof sendCompanyNewSubmissionNotification>[0];

// Call only after the submission transaction commits. Derive the recipient and
// content from saved tenant-owned records, never from public form parameters.
export async function notifyCompanyNewSubmission(companyId: string, submissionId: string) {
  try {
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
    if (!notice) return;
    const destination = notice.destination.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) throw new Error("Invalid notification recipient");
    await sendCompanyNewSubmissionNotification({ ...notice, destination });
  } catch {
    // Even recipient lookup failure must not turn an already saved lead into an
    // error response that invites duplicate submissions. No PII in runtime logs.
    console.error("Company new submission notification failed", { companyId, submissionId });
  }
}
