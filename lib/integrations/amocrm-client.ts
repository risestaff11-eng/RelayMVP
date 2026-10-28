export type AmoStatus = { id: number; name: string; type?: number };
export type AmoPipeline = { id: number; name: string; _embedded: { statuses: AmoStatus[] } };
export type AmoConfig = {
  url: string;
  accountId: number;
  pipelineId: number;
  initialStatusId: number;
  markerFieldId: number;
  contextFieldId: number;
  currency: string;
  paidStatusId: number | null;
  stageMap: Record<string, "REVIEWING" | "IN_PROGRESS" | "AGREEMENT" | "LOST">;
  eventTypes: string[];
  startsAt: string;
};

export function amoOrigin(value: unknown) {
  let url: URL;
  try { url = new URL(String(value).trim()); } catch { throw new Error("Укажите адрес аккаунта amoCRM с https"); }
  if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9-]*\.(amocrm\.ru|kommo\.com)$/.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash || !["", "/"].includes(url.pathname)) {
    throw new Error("Нужен адрес вида https://company.amocrm.ru");
  }
  return url.origin;
}

export class AmoError extends Error {
  constructor(message: string, public status: number | null = null) { super(message); }
}

export async function amoRequest<T>(origin: string, token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const safeOrigin = amoOrigin(origin);
  if (!path.startsWith("/api/v4/") || path.includes("..")) throw new AmoError("Неверный путь API amoCRM");
  let response: Response;
  try {
    response = await fetch(`${safeOrigin}${path}`, {
      method, redirect: "manual", signal: AbortSignal.timeout(8_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new AmoError("amoCRM не ответила. Проверьте соединение и повторите позже."); }
  if (!response.ok) {
    const message = response.status === 401 ? "Доступ amoCRM истёк. Обновите токен подключения."
      : response.status === 403 ? "В amoCRM недостаточно прав для этого действия."
      : response.status === 429 ? "amoCRM ограничила частоту запросов. Доставка будет повторена."
      : `Ошибка amoCRM: HTTP ${response.status}`;
    // Never persist the provider response: it can contain contacts or credentials.
    throw new AmoError(message, response.status);
  }
  if (response.status === 204) return {} as T;
  try { return await response.json() as T; } catch { throw new AmoError("amoCRM вернула непонятный ответ.", response.status); }
}

export async function inspectAmo(input: { url: unknown; token: unknown }) {
  const url = amoOrigin(input.url);
  const token = String(input.token ?? "").trim();
  if (token.length < 20 || token.length > 16000 || /\s/.test(token)) throw new Error("Укажите токен доступа amoCRM");
  const account = await amoRequest<{ id: number; name: string; currency?: string; currency_code?: string }>(url, token, "/api/v4/account");
  const pipelines = await amoRequest<{ _embedded?: { pipelines: AmoPipeline[] } }>(url, token, "/api/v4/leads/pipelines?limit=250");
  if (!Number.isSafeInteger(account.id) || !pipelines._embedded?.pipelines?.length) throw new Error("В аккаунте amoCRM не найдена воронка продаж");
  const rawCurrency = String(account.currency_code || account.currency || "").toUpperCase();
  const currency = ({ "₸": "KZT", "ТГ": "KZT", "РУБ": "RUB", "₽": "RUB", "€": "EUR" } as Record<string, string>)[rawCurrency] || rawCurrency;
  return { url, accountId: account.id, accountName: account.name, currency: /^[A-Z]{3}$/.test(currency) ? currency : "", pipelines: pipelines._embedded.pipelines };
}

export function amoStage(config: AmoConfig, statusId: number, price: number) {
  if (statusId === config.paidStatusId) {
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Для полной оплаты в amoCRM укажите положительную сумму сделки");
    return { reviewStatus: "ACCEPTED", salesStatus: "WON", dealAmount: price };
  }
  const stage = config.stageMap[String(statusId)];
  if (!stage) return null;
  if (stage === "REVIEWING") return { reviewStatus: "REVIEWING", salesStatus: "NONE" };
  return { reviewStatus: "ACCEPTED", salesStatus: stage };
}
