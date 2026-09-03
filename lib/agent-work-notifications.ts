import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { companies, missions, partners, programs, rewards, submissions } from "../db/schema";
import { sendAgentWorkUpdate } from "./agent-email";
import { formatMoney } from "./format-display";
import { reviewStatusNames, salesStatusNames, type ReviewStatus, type SalesStatus } from "./workflow";

// Called only after the business write succeeds. Email outages must not undo a
// saved decision or invite the company to repeat a payment. No client contact
// data or long-lived access tokens are included in messages.
export async function notifyAgentWorkChanges(companyId: string, submissionIds: string[]) {
  if (!submissionIds.length) return;
  try {
    const rows = await getDb().select({
      email: partners.email, companyName: companies.name, programName: programs.name,
      missionTitle: missions.title, reviewStatus: submissions.reviewStatus, salesStatus: submissions.salesStatus,
      rewardStatus: rewards.status, amount: rewards.amount, currency: rewards.currency,
    }).from(submissions)
      .innerJoin(partners, and(eq(partners.id, submissions.partnerId), eq(partners.companyId, companyId), eq(partners.programId, submissions.programId)))
      .innerJoin(companies, eq(companies.id, submissions.companyId))
      .innerJoin(programs, and(eq(programs.id, submissions.programId), eq(programs.companyId, companyId)))
      .innerJoin(missions, and(eq(missions.id, submissions.missionId), eq(missions.programId, programs.id)))
      .leftJoin(rewards, and(eq(rewards.submissionId, submissions.id), eq(rewards.companyId, companyId), eq(rewards.partnerId, partners.id)))
      .where(and(eq(submissions.companyId, companyId), inArray(submissions.id, [...new Set(submissionIds)])));
    const messages = new Map<string, { companyName: string; updates: string[] }>();
    for (const row of rows) {
      const destination = row.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(destination)) continue;
      const reward = row.rewardStatus === "PAID" ? "Компания отметила перевод" : row.rewardStatus === "APPROVED" ? "Вознаграждение одобрено, ожидает выплаты" : row.rewardStatus === "CANCELLED" ? "Вознаграждение отменено" : "Вознаграждение ожидает выполнения условий";
      const amount = row.amount !== null && ["APPROVED", "PAID"].includes(row.rewardStatus ?? "") ? ` · ${formatMoney(row.amount, row.currency || "KZT")}` : "";
      const summary = `${row.programName} — ${row.missionTitle}: ${reviewStatusNames[row.reviewStatus as ReviewStatus] ?? "Статус заявки обновлён"}; ${salesStatusNames[row.salesStatus as SalesStatus] ?? ""}. ${reward}${amount}.`;
      const message = messages.get(destination) ?? { companyName: row.companyName, updates: [] };
      message.updates.push(summary);
      messages.set(destination, message);
    }
    for (const [destination, message] of messages) {
      // One message per person for bulk payouts, not one email per program.
      const updates = message.updates.slice(0, 10);
      if (message.updates.length > 10) updates.push("Остальные изменения доступны в кабинете.");
      await sendAgentWorkUpdate({ destination, companyName: message.companyName, updates }).catch(() => console.error("Agent work notification delivery failed"));
    }
  } catch { console.error("Agent work notification preparation failed"); }
}
