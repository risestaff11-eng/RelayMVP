import { isIP } from "node:net";
import { getD1 } from "../db";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_SUBMISSION_LIMIT = 30;
export const CONTACT_CODE_LIMIT = 5;
const VERIFY_IP_LIMIT = 60;

type Scope = "public-submission-ip" | "contact-verify-ip" | "contact-code-request" | "contact-code-confirm" | "auth-ip" | "auth-identity";
type Counter = { hits: number; reset_at: number };
export type RateLimitState = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export class RequestLimitError extends Error {
  constructor(message: string, readonly status: 429 | 503, readonly retryAfterSeconds: number) { super(message); }
}

export function requestLimitResponse(error: unknown) {
  if (!(error instanceof RequestLimitError)) return null;
  return Response.json({ error: error.message, code: error.status === 429 ? "RATE_LIMITED" : "RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: error.retryAfterSeconds }, {
    status: error.status, headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "no-store" },
  });
}

export function requestIpKey(request: Request) {
  // Only Cloudflare's edge-supplied address is trusted. User-controlled
  // X-Forwarded-For must not create additional buckets. In a deployment without
  // this header all such requests share a limited bucket; never fail open.
  // https://developers.cloudflare.com/fundamentals/reference/http-headers/
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  const version = isIP(value);
  if (version === 4) return value;
  if (version === 6 && !value.includes("%")) return new URL(`http://[${value}]/`).hostname.toLowerCase();
  return "unidentified-ip";
}

async function counterKey(scope: Scope, subject: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(["rate-limit-v1", scope, subject])));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function state(row: Counter | undefined, limit: number, now: number): RateLimitState {
  if (!row || row.reset_at <= now) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  return { allowed: row.hits < limit, remaining: Math.max(0, limit - row.hits), retryAfterSeconds: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) };
}

export async function readRequestLimit(scope: Scope, subject: string, limit: number, now = Date.now()) {
  try {
    const result = await getD1().prepare("SELECT hits, reset_at FROM request_rate_limits WHERE key_hash = ?").bind(await counterKey(scope, subject)).all<Counter>();
    if (!result.success) throw new Error("Counter read failed");
    return state(result.results[0], limit, now);
  } catch { throw new RequestLimitError("Проверка защиты временно недоступна. Попробуйте через минуту.", 503, 60); }
}

export async function takeRequestLimit(scope: Scope, subject: string, limit: number, now = Date.now()): Promise<RateLimitState> {
  try {
    const db = getD1();
    const key = await counterKey(scope, subject);
    // Each statement is prepared separately. D1 executes the batch atomically.
    // No read-then-write race: the UPSERT returns this request's own counter.
    // Expired technical counters are removed in bounded batches during traffic.
    // No expired rows are removed from any business or authentication table.
    const result = await db.batch<Counter>([
      db.prepare("DELETE FROM request_rate_limits WHERE key_hash IN (SELECT key_hash FROM request_rate_limits WHERE reset_at <= ? ORDER BY reset_at LIMIT 100)").bind(now),
      db.prepare(`INSERT INTO request_rate_limits (key_hash, hits, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(key_hash) DO UPDATE SET
          hits = CASE WHEN reset_at <= ? THEN 1 ELSE min(hits + 1, ?) END,
          reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
        RETURNING hits, reset_at`).bind(key, now + RATE_LIMIT_WINDOW_MS, now, limit + 1, now, now + RATE_LIMIT_WINDOW_MS),
    ]);
    const row = result[1]?.results[0];
    if (!result.every((item) => item.success) || !row) throw new Error("Counter update failed");
    return { ...state(row, limit, now), allowed: row.hits <= limit };
  } catch { throw new RequestLimitError("Проверка защиты временно недоступна. Попробуйте через минуту.", 503, 60); }
}

export function requireRequestLimit(limit: RateLimitState, message: string) {
  if (!limit.allowed) throw new RequestLimitError(message, 429, limit.retryAfterSeconds);
}

export async function limitPublicSubmission(request: Request) {
  requireRequestLimit(await takeRequestLimit("public-submission-ip", requestIpKey(request), PUBLIC_SUBMISSION_LIMIT), "Слишком много отправок с вашей сети. Попробуйте через 15 минут.");
}

export async function limitContactVerificationIp(request: Request) {
  requireRequestLimit(await takeRequestLimit("contact-verify-ip", requestIpKey(request), VERIFY_IP_LIMIT), "Слишком много запросов подтверждения с вашей сети. Попробуйте через 15 минут.");
}

export async function limitAuthentication(request: Request, action: string, identity: string) {
  requireRequestLimit(await takeRequestLimit("auth-ip", `${action}:${requestIpKey(request)}`, 60), "Слишком много попыток. Попробуйте через 15 минут.");
  requireRequestLimit(await takeRequestLimit("auth-identity", `${action}:${identity}`, action.endsWith("REQUEST") || action === "register" ? 5 : 15), "Слишком много попыток. Попробуйте через 15 минут.");
}
