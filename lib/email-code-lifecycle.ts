import { getD1 } from "../db";

type CodeTable = "company_email_verification_codes" | "password_reset_codes" | "agent_login_codes";

/** Whitelisted identifiers only. The conditional UPDATE claims a code once, even in parallel. */
export async function claimEmailCode(table: CodeTable, id: string, now: string) {
  const identity = table === "agent_login_codes" ? "newer.email = candidate.email AND newer.phone = candidate.phone" : "newer.user_id = candidate.user_id AND newer.destination = candidate.destination";
  const result = await getD1().prepare(`UPDATE ${table} AS candidate SET consumed_at = ?
    WHERE id = ? AND consumed_at IS NULL AND attempts < 5 AND expires_at >= ?
    AND id = (SELECT newer.id FROM ${table} newer WHERE ${identity} ORDER BY newer.created_at DESC, newer.rowid DESC LIMIT 1)
    RETURNING id`).bind(now, id, now).all();
  return result.results.length === 1;
}
