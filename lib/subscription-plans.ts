export const TRIAL_DAYS = 14;
export const BILLING_DAYS = 30;
export const PAID_PLANS = [
  { code: "STARTER", name: "Старт", price: 19900, programs: 1, credits: 50000, reports: false, integrations: false },
  { code: "GROWTH", name: "Рост", price: 49900, programs: 5, credits: 200000, reports: true, integrations: false },
  { code: "SCALE", name: "Масштаб", price: 99900, programs: 20, credits: 500000, reports: true, integrations: true },
] as const;
export type PaidPlanCode = typeof PAID_PLANS[number]["code"];
export type SubscriptionFeature = "CORE" | "REPORTS" | "INTEGRATIONS";
export type SubscriptionFields = {
  planCode: string;
  subscriptionStatus?: string | null;
  subscriptionEndsAt?: string | null;
};

export function subscriptionState(company: SubscriptionFields, now = Date.now()) {
  // Existing accounts stay operational until the administrator assigns their first term.
  const legacy = !company.subscriptionStatus || company.subscriptionStatus === "LEGACY";
  const trial = company.planCode === "TRIAL";
  const plan = PAID_PLANS.find((item) => item.code === company.planCode) ?? PAID_PLANS[1];
  const ends = company.subscriptionEndsAt ? Date.parse(company.subscriptionEndsAt) : NaN;
  const active = legacy || ((company.subscriptionStatus === "ACTIVE" || company.subscriptionStatus === "TRIAL") && Number.isFinite(ends) && ends > now);
  return {
    legacy, trial, active, plan, endsAt: company.subscriptionEndsAt ?? null,
    daysLeft: Number.isFinite(ends) ? Math.max(0, Math.ceil((ends - now) / 86400000)) : null,
    name: legacy ? "Действующий доступ" : trial ? "Пробный период" : plan.name,
    programs: legacy ? Number.MAX_SAFE_INTEGER : trial ? 5 : plan.programs,
    reports: active && (legacy || trial || plan.reports),
    integrations: active && (legacy || trial || plan.integrations),
  };
}

export function subscriptionAllows(company: SubscriptionFields, feature: SubscriptionFeature, now = Date.now()) {
  const state = subscriptionState(company, now);
  return feature === "REPORTS" ? state.reports : feature === "INTEGRATIONS" ? state.integrations : state.active;
}

export function newTrial(now = new Date()) {
  return { planCode: "TRIAL", subscriptionStatus: "TRIAL", subscriptionStartedAt: now.toISOString(), subscriptionEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString() };
}
