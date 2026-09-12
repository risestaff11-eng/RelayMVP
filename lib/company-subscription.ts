import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, programs } from "../db/schema";
import { subscriptionAllows, subscriptionState, type SubscriptionFeature, type SubscriptionFields } from "./subscription-plans";

export async function companySubscription(companyId: string) {
  return (await getDb().select({ planCode: companies.planCode, subscriptionStatus: companies.subscriptionStatus, subscriptionEndsAt: companies.subscriptionEndsAt }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
}

export async function subscriptionDenied(companyOrId: SubscriptionFields | string, feature: SubscriptionFeature = "CORE") {
  const company = typeof companyOrId === "string" ? await companySubscription(companyOrId) : companyOrId;
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (subscriptionAllows(company, feature)) return null;
  const active = subscriptionState(company).active;
  return Response.json({ code: active ? "PLAN_FEATURE_REQUIRED" : "SUBSCRIPTION_EXPIRED", error: active ? "Эта возможность доступна на другом тарифе. Откройте настройки компании." : "Доступ компании завершён. Продлите тариф в настройках. Данные и выплаты сохранены.", settingsUrl: "/dashboard/settings#subscription" }, { status: 402 });
}

// Used inside the same UPDATE that publishes/restores a program: concurrent requests cannot exceed the limit.
export function programCapacityCondition(companyId: string, programId: string, company: SubscriptionFields) {
  const limit = subscriptionState(company).programs;
  return sql`(select count(*) from programs capacity where capacity.company_id = ${companyId} and capacity.id <> ${programId} and capacity.status in ('ACTIVE', 'PAUSED')) < ${limit}`;
}

export async function programCapacityDenied(companyId: string, programId: string, company: SubscriptionFields) {
  const [row] = await getDb().select({ status: programs.status, allowed: programCapacityCondition(companyId, programId, company) }).from(programs).where(eq(programs.id, programId)).limit(1);
  if (row && ["ACTIVE", "PAUSED"].includes(row.status)) return null;
  return row && !row.allowed ? Response.json({ error: "Достигнут лимит работающих программ. Архивируйте программу или выберите другой тариф." }, { status: 402 }) : null;
}
