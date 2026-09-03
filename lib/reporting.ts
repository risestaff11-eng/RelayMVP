import { formatMoney } from "./format-display";

export function reportMetricEntries(metrics: Record<string, number>) {
  return Object.entries(metrics).filter(([key, value]) => value && !["accrued", "paid", "pending", "confirmed"].includes(key));
}

export function reportMoney(metrics: Record<string, number>, key: string) {
  const rows = Object.entries(metrics).filter(([name]) => name.startsWith(`${key}:`));
  return rows.length ? rows.map(([name, amount]) => formatMoney(amount, name.split(":")[1])).join(" · ") : "0";
}

export function reportMetricValue(key: string, value: number) {
  return key.includes(":") ? formatMoney(value, key.split(":")[1]) : value;
}

export const REPORT_FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "MULTISELECT", "URL", "FILE", "BOOLEAN"] as const;
export type ReportFieldType = typeof REPORT_FIELD_TYPES[number];
export type ReportField = { id: string; label: string; description: string; type: ReportFieldType; required: boolean; enabled: boolean; options: string[]; unit?: string; frequency?: string; sortOrder: number };

const defaults: Array<Omit<ReportField, "sortOrder">> = [
  { id: "work_done", label: "Что сделал", description: "Коротко перечислите выполненные действия", type: "TEXTAREA", required: true, enabled: true, options: [] },
  { id: "main_results", label: "Основные результаты", description: "Что изменилось благодаря вашей работе", type: "TEXTAREA", required: true, enabled: true, options: [] },
  { id: "tasks", label: "Какие задачи выполнял", description: "Задания, встречи и договорённости", type: "TEXTAREA", required: false, enabled: true, options: [] },
  { id: "contacts", label: "С какими клиентами или контактами работал", description: "Без лишних персональных данных", type: "TEXTAREA", required: false, enabled: true, options: [] },
  { id: "wins", label: "Что получилось хорошо", description: "Удачные действия и достижения", type: "TEXTAREA", required: false, enabled: true, options: [] },
  { id: "blockers", label: "Какие возникли сложности", description: "Что мешает двигаться быстрее", type: "TEXTAREA", required: false, enabled: true, options: [] },
  { id: "support", label: "Что требуется от компании", description: "Материалы, ответ или другое действие", type: "TEXTAREA", required: false, enabled: true, options: [] },
  { id: "next_plan", label: "План на следующий период", description: "Следующие конкретные действия", type: "TEXTAREA", required: true, enabled: true, options: [] },
  { id: "comment", label: "Дополнительный комментарий", description: "Всё важное, что не вошло выше", type: "TEXTAREA", required: false, enabled: true, options: [] },
];

export const defaultReportFields = (): ReportField[] => defaults.map((field, sortOrder) => ({ ...field, sortOrder }));
export const DEFAULT_REPORT_METRICS = ["completedTasks", "submissions", "accepted", "rejected", "leads", "deals", "accrued", "paid", "pending", "paidRewardsCount", "pendingRewardsCount"];

export function parseReportFields(value: string | null | undefined): ReportField[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed) || !parsed.length) return defaultReportFields();
    return parsed.filter((item) => item && typeof item === "object").map((item, index) => ({
      id: String(item.id || crypto.randomUUID()).slice(0, 80), label: String(item.label || "Поле").slice(0, 120), description: String(item.description || "").slice(0, 240),
      type: REPORT_FIELD_TYPES.includes(item.type) ? item.type : "TEXTAREA", required: item.required === true, enabled: item.enabled !== false,
      options: Array.isArray(item.options) ? item.options.map(String).filter(Boolean).slice(0, 20) : [], unit: String(item.unit || "").slice(0, 30), frequency: String(item.frequency || "").slice(0, 30), sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : index,
    })).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch { return defaultReportFields(); }
}

export function parseMetricKeys(value: string | null | undefined) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) && parsed.length ? parsed.map(String).filter(Boolean).slice(0, 20) : DEFAULT_REPORT_METRICS; }
  catch { return DEFAULT_REPORT_METRICS; }
}
