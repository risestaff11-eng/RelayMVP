export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function normalizeWebsite(value: string) {
  const prepared = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(prepared);
  if (!parsed.hostname.includes(".") || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Введите корректный публичный адрес сайта");
  }
  assertPublicUrl(parsed);
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function assertPublicUrl(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Разрешены только HTTP и HTTPS сайты");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^fc/i.test(host) ||
    /^fd/i.test(host) ||
    /^fe8|^fe9|^fea|^feb/i.test(host)
  ) {
    throw new Error("Нельзя анализировать локальный или внутренний адрес");
  }
}

export function cleanString(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function cleanList(value: unknown, maxItems = 12, maxLength = 180) {
  if (!Array.isArray(value)) throw new Error("Ожидался список значений");
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}
