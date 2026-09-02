export const REVIEW_SLA_HOURS = 48;
export const PAYOUT_SLA_DAYS = 7;

export type ReviewStatus = "PENDING" | "REVIEWING" | "ACCEPTED" | "REJECTED";
export type SalesStatus = "NONE" | "IN_PROGRESS" | "AGREEMENT" | "WON" | "LOST";

export const reviewStatusNames: Record<ReviewStatus, string> = {
  PENDING: "Ждёт проверки",
  REVIEWING: "Проверяется",
  ACCEPTED: "Принята компанией",
  REJECTED: "Отклонена",
};

export const salesStatusNames: Record<SalesStatus, string> = {
  NONE: "Продажа ещё не началась",
  IN_PROGRESS: "Клиент в работе",
  AGREEMENT: "Договор / предоплата",
  WON: "Оплачено клиентом",
  LOST: "Сделка не состоялась",
};

export function reviewDueAt(createdAt: string | Date) {
  return new Date(new Date(createdAt).getTime() + REVIEW_SLA_HOURS * 60 * 60 * 1000).toISOString();
}

export function payoutDueAt(approvedAt: string | null, plannedAt: string | null) {
  if (plannedAt) return new Date(`${plannedAt.slice(0, 10)}T23:59:59.999Z`).toISOString();
  if (!approvedAt) return null;
  return new Date(new Date(approvedAt).getTime() + PAYOUT_SLA_DAYS * 86400000).toISOString();
}

export function slaState(dueAt: string | null, completed = false, now = Date.now()) {
  if (!dueAt || completed) return { overdue: false, hoursLeft: null, label: completed ? "Выполнено" : "Срок не задан" };
  const difference = new Date(dueAt).getTime() - now;
  const overdue = difference < 0;
  const hours = Math.max(1, Math.ceil(Math.abs(difference) / 3600000));
  if (hours < 48) return { overdue, hoursLeft: overdue ? -hours : hours, label: overdue ? `Просрочено на ${hours} ч.` : `Осталось ${hours} ч.` };
  const days = Math.ceil(hours / 24);
  return { overdue, hoursLeft: overdue ? -hours : hours, label: overdue ? `Просрочено на ${days} дн.` : `Осталось ${days} дн.` };
}

export function legacyStatus(reviewStatus: ReviewStatus, salesStatus: SalesStatus, rewardStatus?: string | null) {
  if (reviewStatus === "PENDING") return "SUBMITTED";
  if (reviewStatus === "REVIEWING") return "REVIEWING";
  if (reviewStatus === "REJECTED") return "REJECTED";
  if (salesStatus === "WON") return rewardStatus === "APPROVED" || rewardStatus === "PAID" ? "REWARDED" : "DEAL";
  if (salesStatus === "IN_PROGRESS" || salesStatus === "AGREEMENT") return "IN_PROGRESS";
  return "ACCEPTED";
}

export function isTestProgramName(name: string) {
  return /(^|[\s_-])(test|demo|sandbox|тест|демо|черновик)([\s_-]|$)/i.test(name.trim());
}

export function isAnalyticsProgram(program: { name: string; status: string }) {
  return program.status !== "ARCHIVED" && !isTestProgramName(program.name);
}
