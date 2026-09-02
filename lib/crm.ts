export type CrmStageId = "NEW" | "REVIEW" | "WORK" | "AGREEMENT" | "PAID" | "CLOSED";

export type CrmStageInput = {
  reviewStatus: string;
  salesStatus: string;
  reward?: { status?: string; partnerConfirmedAt?: string | null } | null;
};

export const CRM_STAGES: Array<{ id: CrmStageId; label: string; hint: string }> = [
  { id: "NEW", label: "Новый", hint: "Ждёт первого решения" },
  { id: "REVIEW", label: "Проверка", hint: "Данные проверяются" },
  { id: "WORK", label: "В работе", hint: "Клиент принят компанией" },
  { id: "AGREEMENT", label: "Договор / предоплата", hint: "Условия согласованы" },
  { id: "PAID", label: "Оплачено", hint: "Клиент оплатил" },
  { id: "CLOSED", label: "Отказ / брак", hint: "Отказ, дубль или нецелевой лид" },
];

export function crmStage(item: CrmStageInput): CrmStageId {
  if (item.reviewStatus === "REJECTED" || item.salesStatus === "LOST") return "CLOSED";
  if (item.salesStatus === "WON") return "PAID";
  if (item.salesStatus === "AGREEMENT") return "AGREEMENT";
  if (item.reviewStatus === "ACCEPTED") return "WORK";
  if (item.reviewStatus === "REVIEWING") return "REVIEW";
  return "NEW";
}

export function crmStageMutation(stage: CrmStageId) {
  if (stage === "NEW") return { reviewStatus: "PENDING", salesStatus: "NONE" } as const;
  if (stage === "REVIEW") return { reviewStatus: "REVIEWING", salesStatus: "NONE" } as const;
  if (stage === "WORK") return { reviewStatus: "ACCEPTED", salesStatus: "IN_PROGRESS" } as const;
  if (stage === "AGREEMENT") return { reviewStatus: "ACCEPTED", salesStatus: "AGREEMENT" } as const;
  if (stage === "PAID") return { reviewStatus: "ACCEPTED", salesStatus: "WON" } as const;
  return { reviewStatus: "ACCEPTED", salesStatus: "LOST" } as const;
}

export function safeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function leadsPerPaymentFromConversion(conversionRate: unknown) {
  const conversion = Math.min(100, safeAmount(conversionRate));
  return conversion > 0 ? Math.max(1, Math.round(100 / conversion)) : 0;
}

export function conversionFromLeadsPerPayment(leadsPerPayment: unknown) {
  const leads = safeAmount(leadsPerPayment);
  return leads > 0 ? Math.max(1, Math.min(100, Math.round(100 / leads))) : 0;
}

export function calculateCrmGoal(monthlyGoal: unknown, averageCheck: unknown, conversionRate: unknown) {
  const goal = safeAmount(monthlyGoal);
  const check = safeAmount(averageCheck);
  const conversion = Math.min(100, safeAmount(conversionRate));
  const payments = goal > 0 && check > 0 ? Math.ceil(goal / check) : 0;
  const leads = payments > 0 && conversion > 0 ? Math.ceil(payments / (conversion / 100)) : 0;
  return { goal, check, conversion, leadsPerPayment: leadsPerPaymentFromConversion(conversion), payments, leads };
}

export function potentialForLead(item: { dealAmount?: unknown; estimatedDealAmount?: unknown }, averageCheck: unknown) {
  const exact = safeAmount(item.dealAmount);
  if (exact > 0) return { amount: exact, kind: "EXACT" as const };
  const estimated = safeAmount(item.estimatedDealAmount);
  if (estimated > 0) return { amount: estimated, kind: "ESTIMATED" as const };
  const fallback = safeAmount(averageCheck);
  return { amount: fallback, kind: fallback > 0 ? "AVERAGE" as const : "NONE" as const };
}
