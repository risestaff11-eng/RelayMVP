const MONTHS_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];
const QYZYLORDA_OFFSET_MS = 5 * 60 * 60 * 1000;

function parts(value: string | Date) {
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);
  const local = new Date(date.getTime() + QYZYLORDA_OFFSET_MS);
  return {
    day: String(local.getUTCDate()).padStart(2, "0"),
    month: local.getUTCMonth(),
    year: local.getUTCFullYear(),
    hour: String(local.getUTCHours()).padStart(2, "0"),
    minute: String(local.getUTCMinutes()).padStart(2, "0"),
    second: String(local.getUTCSeconds()).padStart(2, "0"),
  };
}

export function formatInteger(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatMoney(value: number, currency = "KZT") {
  const symbol = currency === "KZT" ? "₸" : currency === "RUB" ? "₽" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return `${formatInteger(value)} ${symbol}`;
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
  if (normalized.length !== 11 || !normalized.startsWith("7")) return value;
  return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
}

export function formatDate(value: string | Date) {
  const date = parts(value);
  return `${date.day}.${String(date.month + 1).padStart(2, "0")}.${date.year}`;
}

export function formatDateTime(value: string | Date) {
  const date = parts(value);
  return `${date.day}.${String(date.month + 1).padStart(2, "0")}.${date.year}, ${date.hour}:${date.minute}`;
}

export function formatDateTimeSeconds(value: string | Date) {
  const date = parts(value);
  return `${date.day}.${String(date.month + 1).padStart(2, "0")}.${date.year}, ${date.hour}:${date.minute}:${date.second}`;
}

export function formatActivityDate(value: string | Date) {
  const date = parts(value);
  return `${date.day} ${MONTHS_SHORT[date.month]}, ${date.hour}:${date.minute}`;
}
