export type CrmStageId = "NEW" | "REVIEW" | "WORK" | "WON" | "PAID" | "CLOSED";

export type CrmStageInput = {
  reviewStatus: string;
  salesStatus: string;
  reward?: { status?: string; partnerConfirmedAt?: string | null } | null;
};

export const CRM_STAGES: Array<{ id: CrmStageId; label: string; hint: string }> = [
  { id: "NEW", label: "Новые", hint: "Ждут первого решения" },
  { id: "REVIEW", label: "Проверка", hint: "Данные проверяются" },
  { id: "WORK", label: "В работе", hint: "Клиент принят компанией" },
  { id: "WON", label: "Сделка", hint: "Продажа состоялась" },
  { id: "PAID", label: "Оплачено", hint: "Получение подтверждено" },
  { id: "CLOSED", label: "Закрыты", hint: "Отказ или потеря" },
];

export function crmStage(item: CrmStageInput): CrmStageId {
  if (item.reviewStatus === "REJECTED" || item.salesStatus === "LOST") return "CLOSED";
  if (item.salesStatus === "WON" && item.reward?.status === "PAID" && item.reward.partnerConfirmedAt) return "PAID";
  if (item.salesStatus === "WON") return "WON";
  if (item.reviewStatus === "ACCEPTED") return "WORK";
  if (item.reviewStatus === "REVIEWING") return "REVIEW";
  return "NEW";
}

export function safeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function calculateCrmGoal(monthlyGoal: unknown, averageCheck: unknown, conversionRate: unknown, leadsPerAmbassador: unknown) {
  const goal = safeAmount(monthlyGoal);
  const check = safeAmount(averageCheck);
  const conversion = Math.min(100, safeAmount(conversionRate));
  const perAmbassador = safeAmount(leadsPerAmbassador);
  const payments = goal > 0 && check > 0 ? Math.ceil(goal / check) : 0;
  const leads = payments > 0 && conversion > 0 ? Math.ceil(payments / (conversion / 100)) : 0;
  const ambassadors = leads > 0 && perAmbassador > 0 ? Math.ceil(leads / perAmbassador) : 0;
  return { goal, check, conversion, perAmbassador, payments, leads, ambassadors };
}

export function potentialForLead(item: { dealAmount?: unknown; estimatedDealAmount?: unknown }, averageCheck: unknown) {
  const exact = safeAmount(item.dealAmount);
  if (exact > 0) return { amount: exact, kind: "EXACT" as const };
  const estimated = safeAmount(item.estimatedDealAmount);
  if (estimated > 0) return { amount: estimated, kind: "ESTIMATED" as const };
  const fallback = safeAmount(averageCheck);
  return { amount: fallback, kind: fallback > 0 ? "AVERAGE" as const : "NONE" as const };
}
