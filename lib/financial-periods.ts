const LOCAL_OFFSET = 5 * 60 * 60 * 1000;

export function timestamp(value: string) {
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

export function localMonth(now = new Date()) {
  return new Date(now.getTime() + LOCAL_OFFSET).toISOString().slice(0, 7);
}

export function withinPeriod(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  const time = timestamp(value);
  return time >= Date.parse(`${start}T00:00:00+05:00`) && time <= Date.parse(`${end}T23:59:59.999+05:00`);
}

export function withinMonth(value: string | null | undefined, month: string) {
  return !!value && Number.isFinite(timestamp(value)) && new Date(timestamp(value) + LOCAL_OFFSET).toISOString().slice(0, 7) === month;
}

type StageEvent = { fromStatus: string | null; toStatus: string; createdAt: string };
export function saleCompletedAt(events: StageEvent[]) {
  const won = new Set(["DEAL", "REWARDED"]);
  // Note edits/transfer events do not move a completed sale into a different month.
  return events.filter((event) => won.has(event.toStatus) && !won.has(event.fromStatus || ""))
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))[0]?.createdAt ?? null;
}
