import { payoutDueAt, slaState } from "./workflow";

/** Prefer a usable published program; never send setup actions into the archive. */
export function nextCompanyProgram<T extends { status: string }>(programs: T[]) {
  return programs.find((program) => program.status === "ACTIVE")
    ?? programs.find((program) => program.status === "DRAFT")
    ?? programs.find((program) => program.status === "PAUSED");
}

export type PayoutRow = {
  status: string; approvedAt: string | null; plannedAt: string | null;
  createdAt: string; partnerConfirmedAt: string | null;
};
export const PAYOUT_FILTERS = ["ALL", "APPROVED", "OVERDUE", "AWAITING_RECEIPT", "CONFIRMED", "PENDING", "CANCELLED"] as const;
export type PayoutFilter = typeof PAYOUT_FILTERS[number];
export function payoutFilter(value?: string): PayoutFilter {
  return PAYOUT_FILTERS.find((filter) => filter === value) ?? "ALL";
}
export function companyPayoutSla(row: PayoutRow, days: number, now = Date.now()) {
  // A pending/cancelled reward is not an outstanding payable debt.
  const due = row.status === "APPROVED" ? payoutDueAt(row.approvedAt || row.createdAt, row.plannedAt, days) : null;
  return slaState(due, row.status === "PAID", now);
}
export function matchesPayoutFilter(row: PayoutRow, filter: PayoutFilter, days: number, now = Date.now()) {
  if (filter === "ALL") return true;
  if (filter === "OVERDUE") return companyPayoutSla(row, days, now).overdue;
  if (filter === "AWAITING_RECEIPT") return row.status === "PAID" && !row.partnerConfirmedAt;
  if (filter === "CONFIRMED") return row.status === "PAID" && Boolean(row.partnerConfirmedAt);
  return row.status === filter;
}

/** Quoting alone does not prevent spreadsheet formula injection. */
export function payoutCsvCell(value: string | number) {
  const raw = String(value);
  let first = 0;
  while (first < raw.length && (raw.charCodeAt(first) <= 32 || /\s/u.test(raw[first]))) first++;
  const formula = ["=", "+", "@", "-"].includes(raw[first]);
  const safe = formula || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
