import { getD1, getDb } from ".";
import { companyMembers, users } from "./schema";
import { eq } from "drizzle-orm";
import { getSubmissionsForCompany } from "./programs";
import { CRM_STAGES } from "../lib/crm";
import { localMonth } from "../lib/financial-periods";

const stageSql = "CASE WHEN s.review_status = 'REJECTED' OR s.sales_status = 'LOST' THEN 'CLOSED' WHEN s.sales_status = 'WON' THEN 'PAID' WHEN s.sales_status = 'AGREEMENT' THEN 'AGREEMENT' WHEN s.review_status = 'ACCEPTED' THEN 'WORK' WHEN s.review_status = 'REVIEWING' THEN 'REVIEW' ELSE 'NEW' END";
export type BoardQuery = { q?: string; program?: string; ambassador?: string; quick?: string; month?: string; stage?: string; cursorDate?: string; cursorId?: string };
export type BoardTotals = { stage: string; currency: string; count: number; amount: number }[];

export async function crmBoard(company: { id: string; crmAverageCheck: number; crmGoalCurrency: string }, query: BoardQuery = {}) {
  const db = getD1();
  const where = ["s.company_id = ?"];
  const args: (string | number)[] = [company.id];
  if (query.q?.trim()) { where.push("instr(lower(s.contact_name || ' ' || s.contact_phone || ' ' || s.contact_company || ' ' || p.name || ' ' || a.name || ' ' || a.email || ' ' || a.phone || ' ' || m.title), lower(?)) > 0"); args.push(query.q.trim().slice(0, 200)); }
  if (query.program && query.program !== "ALL") { where.push("p.name = ?"); args.push(query.program); }
  if (query.ambassador && query.ambassador !== "ALL") { where.push("a.email = ?"); args.push(query.ambassador); }
  if (query.quick === "ACTION") where.push(`((${stageSql}) IN ('NEW','REVIEW') OR (s.next_action_at IS NOT NULL AND julianday(s.next_action_at) <= julianday('now') AND (${stageSql}) NOT IN ('PAID','CLOSED')))`);
  if (query.quick === "WORK") where.push(`(${stageSql}) IN ('WORK','AGREEMENT')`);
  if (query.quick === "MONEY") where.push(`(${stageSql}) IN ('AGREEMENT','PAID')`);
  if (query.quick === "CLOSED") where.push(`(${stageSql}) = 'CLOSED'`);
  const join = "FROM submissions s JOIN programs p ON p.id = s.program_id JOIN partners a ON a.id = s.partner_id JOIN missions m ON m.id = s.mission_id";
  const filter = where.join(" AND ");
  const stages = CRM_STAGES.filter((stage) => !query.stage || stage.id === query.stage);
  const idPages = await Promise.all(stages.map(async ({ id }) => {
    const cursor = query.cursorDate && query.cursorId ? " AND (s.created_at < ? OR (s.created_at = ? AND s.id < ?))" : "";
    const cursorArgs = cursor ? [query.cursorDate!, query.cursorDate!, query.cursorId!] : [];
    return db.prepare(`SELECT s.id ${join} WHERE ${filter} AND (${stageSql}) = ?${cursor} ORDER BY s.created_at DESC, s.id DESC LIMIT 20`).bind(...args, id, ...cursorArgs).all<{ id: string }>();
  }));
  const amountSql = "CASE WHEN s.deal_amount > 0 THEN s.deal_amount WHEN s.estimated_deal_amount > 0 THEN s.estimated_deal_amount WHEN p.currency = ? THEN ? ELSE 0 END";
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? query.month! : localMonth();
  const [items, totals, facts, potential, programRows, agentRows, members] = await Promise.all([
    getSubmissionsForCompany(company.id, { ids: idPages.flatMap((page) => page.results.map((row) => row.id)), details: false }),
    db.prepare(`SELECT (${stageSql}) AS stage, p.currency, count(*) AS count, sum(${amountSql}) AS amount ${join} WHERE ${filter} GROUP BY stage,p.currency`).bind(company.crmGoalCurrency, company.crmAverageCheck, ...args).all<BoardTotals[number]>(),
    db.prepare(`SELECT coalesce(sum(s.deal_amount),0) AS amount FROM submissions s JOIN programs p ON p.id=s.program_id WHERE s.company_id=? AND s.sales_status='WON' AND s.review_status <> 'REJECTED' AND p.currency=? AND strftime('%Y-%m',(SELECT max(e.created_at) FROM submission_status_events e WHERE e.submission_id=s.id AND e.to_status IN ('DEAL','REWARDED') AND coalesce(e.from_status,'') NOT IN ('DEAL','REWARDED')),'+5 hours')=?`).bind(company.id, company.crmGoalCurrency, month).first<{ amount: number }>(),
    db.prepare(`SELECT coalesce(sum(${amountSql}),0) AS amount FROM submissions s JOIN programs p ON p.id=s.program_id WHERE s.company_id=? AND s.review_status <> 'REJECTED' AND s.sales_status NOT IN ('WON','LOST') AND p.currency=?`).bind(company.crmGoalCurrency, company.crmAverageCheck, company.id, company.crmGoalCurrency).first<{ amount: number }>(),
    db.prepare("SELECT DISTINCT name FROM programs WHERE company_id=? ORDER BY name").bind(company.id).all<{ name: string }>(),
    db.prepare("SELECT email, max(name) AS name FROM partners WHERE company_id=? GROUP BY email ORDER BY name").bind(company.id).all<{ email: string; name: string }>(),
    getDb().select({ id: users.id, name: users.displayName }).from(companyMembers).innerJoin(users, eq(users.id, companyMembers.userId)).where(eq(companyMembers.companyId, company.id)),
  ]);
  return { items, totals: totals.results, fact: facts?.amount ?? 0, potential: potential?.amount ?? 0, programs: programRows.results.map((row) => row.name), ambassadors: agentRows.results.map((row) => [row.email, row.name] as [string, string]), members };
}
