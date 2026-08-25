export const statusNames: Record<string, string> = {
  SUBMITTED: "Отправлен",
  REVIEWING: "Проверяется",
  ACCEPTED: "Принят",
  IN_PROGRESS: "В работе",
  DEAL: "Сделка",
  REWARDED: "Вознаграждение",
  REJECTED: "Отклонён",
};

export const typeNames: Record<string, string> = { LEAD: "Люди", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };

export function money(value: number, currency: string) {
  return `${value.toLocaleString("ru-RU")} ${currency === "KZT" ? "₸" : currency}`;
}

export function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "—";
}
