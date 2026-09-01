import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { agentSessions } from "../db/schema";
import { createPartnerToken, hashPartnerToken } from "./partner-token";

const AGENT_SESSION_COOKIE = "risestaff_agent_session";
const LEGACY_AGENT_SESSION_COOKIE = "yaler_agent_session";
const AGENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeAgentEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 180);
}

export function normalizeAgentPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits.slice(0, 20);
}

export async function createAgentSession(email: string, phone: string) {
  const rawToken = createPartnerToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + AGENT_SESSION_TTL_MS);
  await getDb().insert(agentSessions).values({
    id: await hashPartnerToken(rawToken),
    email: normalizeAgentEmail(email),
    phone: normalizeAgentPhone(phone),
    expiresAt: expiresAt.toISOString(),
    lastUsedAt: now,
    createdAt: now,
  });
  const jar = await cookies();
  jar.set(AGENT_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAgentSession() {
  const jar = await cookies();
  const rawToken = jar.get(AGENT_SESSION_COOKIE)?.value ?? jar.get(LEGACY_AGENT_SESSION_COOKIE)?.value;
  if (!rawToken) return null;
  const now = new Date().toISOString();
  const row = (await getDb().select().from(agentSessions).where(and(
    eq(agentSessions.id, await hashPartnerToken(rawToken)),
    gt(agentSessions.expiresAt, now),
  )).limit(1))[0];
  if (!row) return null;
  await getDb().update(agentSessions).set({ lastUsedAt: now }).where(eq(agentSessions.id, row.id));
  return { email: row.email, phone: row.phone, expiresAt: row.expiresAt };
}

export async function clearAgentSession() {
  const jar = await cookies();
  const rawToken = jar.get(AGENT_SESSION_COOKIE)?.value ?? jar.get(LEGACY_AGENT_SESSION_COOKIE)?.value;
  if (rawToken) await getDb().delete(agentSessions).where(eq(agentSessions.id, await hashPartnerToken(rawToken)));
  jar.set(AGENT_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
  jar.set(LEGACY_AGENT_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
}
