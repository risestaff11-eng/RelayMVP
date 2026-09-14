export type CurrencyTotal = { currency: string; paid: number; due: number };

export function currencyTotals(values: string[]): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const value of values) {
    let rows: unknown;
    try { rows = JSON.parse(value); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) continue;
      const total = totals.get(row.currency) ?? { currency: row.currency, paid: 0, due: 0 };
      total.paid += Number.isFinite(row.paid) ? row.paid : 0;
      total.due += Number.isFinite(row.due) ? row.due : 0;
      totals.set(row.currency, total);
    }
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function currencySummary(values: string[], key: "paid" | "due") {
  return currencyTotals(values).filter((row) => row[key] !== 0)
    .map((row) => `${row[key].toLocaleString("ru-RU")} ${row.currency}`).join(" · ") || "—";
}
