import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { serializeProfile } from "../../../../../db/profile";
import { companies, companyProfileVersions } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanString(payload.id, 80);
    const rows = await getDb().select().from(companyProfileVersions).where(and(eq(companyProfileVersions.id, id), eq(companyProfileVersions.companyId, company.id))).limit(1);
    const profile = rows[0];
    if (!profile) throw new Error("Версия профиля не найдена");
    if (profile.status !== "DRAFT") throw new Error("Эта версия уже обработана");
    const products = JSON.parse(profile.productsJson) as unknown[];
    if (!profile.businessDescription.trim() || !profile.targetAudience.trim() || !profile.partnerPitch.trim() || !Array.isArray(products) || products.length === 0) {
      throw new Error("Для подтверждения заполните описание бизнеса, продукты, целевую аудиторию и партнёрский питч");
    }

    const db = getDb();
    const now = new Date().toISOString();
    await db.batch([
      db.update(companyProfileVersions).set({ status: "SUPERSEDED", updatedAt: now }).where(and(eq(companyProfileVersions.companyId, company.id), eq(companyProfileVersions.status, "CONFIRMED"))),
      db.update(companyProfileVersions).set({ status: "CONFIRMED", confirmedAt: now, updatedAt: now }).where(eq(companyProfileVersions.id, id)),
      db.update(companies).set({ onboardingStatus: "PROFILE_CONFIRMED", updatedAt: now }).where(eq(companies.id, company.id)),
    ]);
    return Response.json({ profile: serializeProfile({ ...profile, status: "CONFIRMED", confirmedAt: now, updatedAt: now }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подтвердить профиль";
    return Response.json({ error: message }, { status: 400 });
  }
}
