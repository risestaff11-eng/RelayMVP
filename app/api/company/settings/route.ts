import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { companies } from "../../../../db/schema";
import { normalizeWebsite, sameOrigin } from "../_utils";

const PLANS = new Set(["TRIAL", "STARTER", "GROWTH"]);

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const websiteValue = typeof payload.website === "string" ? normalizeWebsite(payload.website.trim()) : null;
    const planCode = typeof payload.planCode === "string" ? payload.planCode : null;
    if (!websiteValue && !planCode) throw new Error("Нет данных для сохранения");
    if (planCode && !PLANS.has(planCode)) throw new Error("Неизвестный тариф");
    if (planCode) throw new Error("Автоматическая смена тарифа пока не подключена");

    const now = new Date().toISOString();
    const changes: Partial<typeof companies.$inferInsert> = { updatedAt: now };
    if (websiteValue) {
      changes.website = websiteValue;
      if (websiteValue !== company.website) changes.onboardingStatus = "WEBSITE_UPDATED";
    }

    await getDb().update(companies).set(changes).where(eq(companies.id, company.id));
    return Response.json({
      website: websiteValue ?? company.website,
      planCode: planCode ?? company.planCode,
      aiTokenBalance: changes.aiTokenBalance ?? company.aiTokenBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить настройки";
    return Response.json({ error: message }, { status: 400 });
  }
}
