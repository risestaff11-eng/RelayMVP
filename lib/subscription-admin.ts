import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, subscriptionEvents } from "../db/schema";
import { BILLING_DAYS, PAID_PLANS, TRIAL_DAYS } from "./subscription-plans";

export async function changeSubscription(companyId: string, actor: string, input: Record<string, unknown>, now = new Date()) {
  const id = String(input.requestId ?? "");
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error("Обновите страницу и повторите действие");
  const db = getDb();
  const existing = (await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.id, id)).limit(1))[0];
  if (existing) {
    if (existing.companyId !== companyId) throw new Error("Запрос относится к другой компании");
    return existing;
  }
  const company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) throw new Error("Компания не найдена");
  const revision = Number(input.revision);
  if (revision !== company.subscriptionRevision) throw new Error("Тариф уже изменён. Обновите страницу");
  const action = String(input.action);
  if (!["ACTIVATE", "EXTEND", "TRIAL", "SUSPEND"].includes(action)) throw new Error("Выберите действие с доступом");
  const plan = PAID_PLANS.find((item) => item.code === input.planCode);
  if ((action === "ACTIVATE" || action === "EXTEND") && !plan) throw new Error("Выберите тариф");
  if (action === "EXTEND" && (company.subscriptionStatus !== "ACTIVE" || company.planCode !== plan?.code)) throw new Error("Продлевать можно только текущий активный тариф");
  const days = action === "TRIAL" ? TRIAL_DAYS : action === "SUSPEND" ? 0 : Number(input.days ?? BILLING_DAYS);
  if (!Number.isSafeInteger(days) || days < 0 || days > 366 || ((action === "ACTIVATE" || action === "EXTEND") && days < 1)) throw new Error("Укажите срок от 1 до 366 дней");
  const paidAmount = Number(input.paidAmount ?? 0);
  if (!Number.isSafeInteger(paidAmount) || paidAmount < 0 || paidAmount > 100000000) throw new Error("Проверьте сумму оплаты");
  const note = String(input.note ?? "").trim().slice(0, 1000);
  if (!note) throw new Error("Добавьте основание изменения доступа");
  const start = action === "EXTEND" ? Math.max(now.getTime(), Date.parse(company.subscriptionEndsAt ?? "") || 0) : now.getTime();
  const endsAt = action === "SUSPEND" ? company.subscriptionEndsAt : new Date(start + days * 86400000).toISOString();
  const planCode = action === "SUSPEND" ? company.planCode : action === "TRIAL" ? "TRIAL" : plan!.code;
  // Credits are explicitly granted by an admin, never implicitly on retries or plan edits.
  const creditsGranted = input.grantCredits === true && plan && (action === "ACTIVATE" || action === "EXTEND") ? plan.credits : 0;
  const event = { id, companyId, revision: revision + 1, actor, action, planCode, endsAt, paidAmount, creditsGranted, note, createdAt: now.toISOString() };
  // Unique company/revision + transaction makes conflicting admin tabs roll back together.
  await db.batch([
    db.insert(subscriptionEvents).values(event),
    db.update(companies).set({ planCode, subscriptionStatus: action === "SUSPEND" ? "SUSPENDED" : action === "TRIAL" ? "TRIAL" : "ACTIVE", subscriptionStartedAt: action === "EXTEND" || action === "SUSPEND" ? company.subscriptionStartedAt : now.toISOString(), subscriptionEndsAt: endsAt, subscriptionRevision: revision + 1, aiTokenBalance: sql`${companies.aiTokenBalance} + ${creditsGranted}`, updatedAt: now.toISOString() }).where(and(eq(companies.id, companyId), eq(companies.subscriptionRevision, revision))),
  ]);
  return event;
}

export async function subscriptionHistory(companyId: string) {
  return getDb().select().from(subscriptionEvents).where(eq(subscriptionEvents.companyId, companyId)).orderBy(desc(subscriptionEvents.revision)).limit(30);
}
