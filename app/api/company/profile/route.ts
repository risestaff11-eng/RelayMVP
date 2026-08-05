import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { serializeProfile } from "../../../../db/profile";
import { companyProfileVersions } from "../../../../db/schema";
import { cleanList, cleanString, sameOrigin } from "../_utils";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanString(payload.id, 80);
    const rows = await getDb().select().from(companyProfileVersions).where(and(eq(companyProfileVersions.id, id), eq(companyProfileVersions.companyId, company.id))).limit(1);
    const current = rows[0];
    if (!current) throw new Error("Версия профиля не найдена");
    if (current.status !== "DRAFT") throw new Error("Подтверждённую версию нельзя менять. Запустите новый анализ.");

    const businessDescription = cleanString(payload.businessDescription, 3000);
    const products = cleanList(payload.products);
    const targetAudience = cleanString(payload.targetAudience, 2000);
    const advantages = cleanList(payload.advantages);
    const buyingTriggers = cleanList(payload.buyingTriggers);
    const disqualifiers = cleanList(payload.disqualifiers);
    const geographies = cleanList(payload.geographies);
    const partnerPitch = cleanString(payload.partnerPitch, 2000);
    const fieldValues: Record<string, boolean> = {
      "Описание бизнеса": Boolean(businessDescription),
      "Продукты и услуги": products.length > 0,
      "Целевая аудитория": Boolean(targetAudience),
      "Ключевые преимущества": advantages.length > 0,
      "Триггеры покупки": buyingTriggers.length > 0,
      "Неподходящие клиенты": disqualifiers.length > 0,
      "География продаж": geographies.length > 0,
      "Партнёрский питч": Boolean(partnerPitch),
    };
    const missingFields = Object.entries(fieldValues).filter(([, filled]) => !filled).map(([name]) => name);
    const now = new Date().toISOString();
    await getDb().update(companyProfileVersions).set({
      businessDescription,
      productsJson: JSON.stringify(products),
      targetAudience,
      advantagesJson: JSON.stringify(advantages),
      buyingTriggersJson: JSON.stringify(buyingTriggers),
      disqualifiersJson: JSON.stringify(disqualifiers),
      geographiesJson: JSON.stringify(geographies),
      partnerPitch,
      missingFieldsJson: JSON.stringify(missingFields),
      updatedAt: now,
    }).where(eq(companyProfileVersions.id, id));
    const updated = { ...current, businessDescription, productsJson: JSON.stringify(products), targetAudience, advantagesJson: JSON.stringify(advantages), buyingTriggersJson: JSON.stringify(buyingTriggers), disqualifiersJson: JSON.stringify(disqualifiers), geographiesJson: JSON.stringify(geographies), partnerPitch, missingFieldsJson: JSON.stringify(missingFields), updatedAt: now };
    return Response.json({ profile: serializeProfile(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить профиль";
    return Response.json({ error: message }, { status: 400 });
  }
}
