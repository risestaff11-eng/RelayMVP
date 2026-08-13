const MONTHS_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];
const QYZYLORDA_OFFSET_MS = 5 * 60 * 60 * 1000;

function parts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + QYZYLORDA_OFFSET_MS);
  return {
    day: String(local.getUTCDate()).padStart(2, "0"),
    month: local.getUTCMonth(),
    year: local.getUTCFullYear(),
    hour: String(local.getUTCHours()).padStart(2, "0"),
    minute: String(local.getUTCMinutes()).padStart(2, "0"),
  };
}

export function formatInteger(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatDate(value: string | Date) {
  const date = parts(value);
  return `${date.day}.${String(date.month + 1).padStart(2, "0")}.${date.year}`;
}

export function formatDateTime(value: string | Date) {
  const date = parts(value);
  return `${date.day}.${String(date.month + 1).padStart(2, "0")}.${date.year}, ${date.hour}:${date.minute}`;
}

export function formatActivityDate(value: string | Date) {
  const date = parts(value);
  return `${date.day} ${MONTHS_SHORT[date.month]}, ${date.hour}:${date.minute}`;
}
