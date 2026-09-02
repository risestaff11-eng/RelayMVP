import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies } from "../db/schema";

export async function reserveCompanyAiCredits(companyId: string, maximum: number) {
  const amount = Math.max(0, Math.round(maximum));
  const rows = await getDb().update(companies).set({ aiTokenBalance: sql`${companies.aiTokenBalance} - ${amount}`, aiTokensUsed: sql`${companies.aiTokensUsed} + ${amount}`, updatedAt: new Date().toISOString() }).where(and(eq(companies.id, companyId), gte(companies.aiTokenBalance, amount))).returning({ balance: companies.aiTokenBalance });
  return rows[0] ? { reserved: amount, balance: rows[0].balance } : null;
}

export async function settleCompanyAiCredits(companyId: string, reserved: number, actual: number) {
  const used = Math.max(0, Math.min(Math.round(reserved), Math.round(actual)));
  const refund = Math.max(0, Math.round(reserved) - used);
  if (refund) await getDb().update(companies).set({ aiTokenBalance: sql`${companies.aiTokenBalance} + ${refund}`, aiTokensUsed: sql`max(${companies.aiTokensUsed} - ${refund}, 0)`, updatedAt: new Date().toISOString() }).where(eq(companies.id, companyId));
  return used;
}
