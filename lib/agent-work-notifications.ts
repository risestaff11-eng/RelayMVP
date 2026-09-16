import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, getD1 } from "../db";
import { companies, missions, partners, programs, rewards, submissions } from "../db/schema";
import { sendAgentWorkUpdate } from "./agent-email";
import { formatMoney } from "./format-display";
import { reviewStatusNames, salesStatusNames, type ReviewStatus, type SalesStatus } from "./workflow";
// Called only after the business write succeeds. Email outages must not undo a
// saved decision or invite the company to repeat a payment. No client contact
// data or long-lived access tokens are included in messages.
async function deliverAgentWorkChanges(companyId: string, submissionIds: string[]) {
    if (!submissionIds.length)
        return;
    try {
        const rows = await getDb().select({
            email: partners.email, companyName: companies.name, programName: programs.name,
            missionTitle: missions.title, reviewStatus: submissions.reviewStatus, salesStatus: submissions.salesStatus,
            rewardStatus: rewards.status, amount: rewards.amount, currency: rewards.currency,
            latestActor: sql<string> `(SELECT actor_type FROM submission_status_events WHERE submission_id=${submissions.id} ORDER BY created_at DESC,id DESC LIMIT 1)`,
        }).from(submissions)
            .innerJoin(partners, and(eq(partners.id, submissions.partnerId), eq(partners.companyId, companyId), eq(partners.programId, submissions.programId)))
            .innerJoin(companies, eq(companies.id, submissions.companyId))
            .innerJoin(programs, and(eq(programs.id, submissions.programId), eq(programs.companyId, companyId)))
            .innerJoin(missions, and(eq(missions.id, submissions.missionId), eq(missions.programId, programs.id)))
            .leftJoin(rewards, and(eq(rewards.submissionId, submissions.id), eq(rewards.companyId, companyId), eq(rewards.partnerId, partners.id)))
            .where(and(eq(submissions.companyId, companyId), inArray(submissions.id, [...new Set(submissionIds)])));
        const messages = new Map<string, {
            companyName: string;
            updates: string[];
        }>();
        for (const row of rows) {
            const destination = row.email.trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(destination))
                continue;
            const reward = row.rewardStatus === "PAID" ? "Компания отметила перевод" : row.rewardStatus === "APPROVED" ? "Вознаграждение одобрено, ожидает выплаты" : row.rewardStatus === "CANCELLED" ? "Вознаграждение отменено" : "Вознаграждение ожидает выполнения условий";
            const amount = row.amount !== null && ["APPROVED", "PAID"].includes(row.rewardStatus ?? "") ? ` · ${formatMoney(row.amount, row.currency || "KZT")}` : "";
            const summary = row.latestActor === "COMPANY_REQUEST" ? `${row.programName} — ${row.missionTitle}: Компания просит уточнение` : `${row.programName} — ${row.missionTitle}: ${reviewStatusNames[row.reviewStatus as ReviewStatus] ?? "Статус заявки обновлён"}; ${salesStatusNames[row.salesStatus as SalesStatus] ?? ""}. ${reward}${amount}.`;
            const message = messages.get(destination) ?? { companyName: row.companyName, updates: [] };
            message.updates.push(summary);
            messages.set(destination, message);
        }
        for (const [destination, message] of messages) {
            // One message per person for bulk payouts, not one email per program.
            const updates = message.updates.slice(0, 10);
            if (message.updates.length > 10)
                updates.push("Остальные изменения доступны в кабинете.");
            await sendAgentWorkUpdate({ destination, companyName: message.companyName, updates });
        }
    }
    catch {
        throw new Error("Agent notification unavailable");
    }
}
export async function notifyAgentWorkChanges(companyId: string, submissionIds: string[]) {
    try {
        for (const id of [...new Set(submissionIds)]) {
            const row = await getD1().prepare("SELECT s.updated_at AS stamp, (SELECT id FROM submission_status_events e WHERE e.submission_id=s.id ORDER BY created_at DESC, id DESC LIMIT 1) AS eventId FROM submissions s WHERE s.id=? AND s.company_id=?").bind(id, companyId).first<{
                stamp: string;
                eventId: string | null;
            }>();
            if (!row)
                continue;
            const key = JSON.stringify([companyId, id, row.stamp, row.eventId]);
            await getD1().prepare("INSERT OR IGNORE INTO agent_email_jobs (id,company_id,submission_id,next_attempt_at) VALUES (?,?,?,?)").bind(key, companyId, id, new Date().toISOString()).run();
        }
        await drainAgentNotifications();
    }
    catch {
        console.error("Agent notification queued delivery unavailable");
    }
}
export async function drainAgentNotifications() {
    const db = getD1();
    const now = new Date().toISOString();
    const lease = crypto.randomUUID();
    await db.prepare("UPDATE agent_email_jobs SET status=CASE WHEN attempts>=6 THEN 'FAILED' ELSE 'RETRY' END, lease_token=NULL, lease_until=NULL WHERE status='PROCESSING' AND lease_until<=?").bind(now).run();
    const rows = await db.prepare("SELECT id,company_id AS companyId,submission_id AS submissionId FROM agent_email_jobs WHERE status IN ('PENDING','RETRY') AND attempts<6 AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT 10").bind(now).all<{
        id: string;
        companyId: string;
        submissionId: string;
    }>();
    const claimed: Array<{
        id: string;
        companyId: string;
        submissionId: string;
    }> = [];
    for (const row of rows.results) {
        const result = await db.prepare("UPDATE agent_email_jobs SET status='PROCESSING',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=? AND status IN ('PENDING','RETRY') AND next_attempt_at<=?").bind(lease, new Date(Date.now() + 300000).toISOString(), row.id, now).run();
        if (result.meta.changes)
            claimed.push(row);
    }
    for (const companyId of new Set(claimed.map(r => r.companyId))) {
        const group = claimed.filter(r => r.companyId === companyId);
        let delivered = false;
        try {
            await deliverAgentWorkChanges(companyId, [...new Set(group.map(r => r.submissionId))]);
            delivered = true;
        }
        catch {
            console.error("Agent email delivery will retry");
        }
        for (const row of group) {
            if (delivered)
                await db.prepare("UPDATE agent_email_jobs SET status='SENT',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(row.id, lease).run();
            else
                await db.prepare("UPDATE agent_email_jobs SET status=CASE WHEN attempts>=6 THEN 'FAILED' ELSE 'RETRY' END,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(new Date(Date.now() + 300000).toISOString(), row.id, lease).run();
        }
    }
    await db.prepare("DELETE FROM agent_drafts WHERE (partner_id,mission_id) IN (SELECT partner_id,mission_id FROM agent_drafts WHERE expires_at<=? LIMIT 100)").bind(now).run();
}
