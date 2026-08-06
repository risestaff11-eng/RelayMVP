import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { authSessions, userRoles, users } from "../db/schema";

const SESSION_COOKIE = "relay_session";
const ADMIN_COOKIE = "relay_admin";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;

export type AccountUser = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
  phone: string;
  companyName: string;
  status: string;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function sameValue(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return `pbkdf2_sha256$100000$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, iterationsValue, saltValue, expected] = stored.split("$");
  const iterations = Number(iterationsValue);
  if (algorithm !== "pbkdf2_sha256" || iterations !== 100_000 || !saltValue || !expected) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(saltValue), iterations }, key, 256);
  return sameValue(bytesToBase64Url(new Uint8Array(bits)), expected);
}

export async function createAuthSession(userId: string) {
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const id = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { getDb } = await import("../db");
  await getDb().insert(authSessions).values({ id, userId, expiresAt: expiresAt.toISOString() });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, rawToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function clearAuthSession() {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const { getDb } = await import("../db");
    await getDb().delete(authSessions).where(eq(authSessions.id, await sha256(rawToken)));
  }
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
}

export async function getAccountUser(): Promise<AccountUser | null> {
  const rawToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;
  const { getDb } = await import("../db");
  const rows = await getDb().select({
    userId: users.id,
    email: users.email,
    displayName: users.displayName,
    phone: users.phone,
    companyName: users.companyName,
    status: users.status,
  }).from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .where(and(eq(authSessions.id, await sha256(rawToken)), gt(authSessions.expiresAt, new Date().toISOString())))
    .limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return null;
  return { ...user, fullName: user.displayName || null };
}

async function runtimeAdminSecret() {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as { ADMIN_SECRET?: string }).ADMIN_SECRET?.trim() ?? "";
}

async function adminCookieValue(secret: string) {
  return sha256(`relay-admin:${secret}`);
}

export async function verifyAdminPassword(password: string) {
  const secret = await runtimeAdminSecret();
  if (!secret) return false;
  return sameValue(await adminCookieValue(password), await adminCookieValue(secret));
}

export async function createAdminSession() {
  const secret = await runtimeAdminSecret();
  if (!secret) throw new Error("ADMIN_SECRET не настроен");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await adminCookieValue(secret), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.floor(ADMIN_TTL_MS / 1000) });
}

export async function hasAdminSession() {
  const secret = await runtimeAdminSecret();
  const current = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  return Boolean(secret && current && sameValue(current, await adminCookieValue(secret)));
}
