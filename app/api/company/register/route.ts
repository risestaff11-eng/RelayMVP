import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { companies, companyMembers, users } from "../../../../db/schema";

const INDUSTRIES = new Set(["IT_AND_AUTOMATION", "MARKETING", "CONSULTING", "RECRUITING", "EDUCATION", "OTHER"]);
const TEAM_SIZES = new Set(["1_10", "11_50", "51_200", "201_PLUS"]);
const GOALS = new Set(["LEADS", "DEALS", "AMBASSADORS", "MIXED"]);

function normalizeWebsite(value: string) {
  const prepared = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(prepared);
  if (!parsed.hostname.includes(".") || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Введите корректный адрес сайта");
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = String(payload.name ?? "").trim();
    const industry = String(payload.industry ?? "");
    const teamSize = String(payload.teamSize ?? "");
    const primaryGoal = String(payload.primaryGoal ?? "");
    if (name.length < 2 || name.length > 80) throw new Error("Название должно содержать от 2 до 80 символов");
    if (!INDUSTRIES.has(industry) || !TEAM_SIZES.has(teamSize) || !GOALS.has(primaryGoal)) throw new Error("Проверьте выбранные параметры компании");
    const website = normalizeWebsite(String(payload.website ?? "").trim());

    const db = getDb();
    const existing = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, user.userId)).limit(1);
    if (existing[0]) return Response.json({ companyId: existing[0].companyId, existing: true });

    const companyId = crypto.randomUUID();
    await db.batch([
      db.insert(users).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: users.id, set: { email: user.email, displayName: user.displayName, updatedAt: new Date().toISOString() } }),
      db.insert(companies).values({ id: companyId, ownerUserId: user.userId, name, website, industry, teamSize, primaryGoal, aiTokenBalance: 5000 }),
      db.insert(companyMembers).values({ companyId, userId: user.userId, role: "OWNER" }),
    ]);

    return Response.json({ companyId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать компанию";
    return Response.json({ error: message }, { status: 400 });
  }
}
