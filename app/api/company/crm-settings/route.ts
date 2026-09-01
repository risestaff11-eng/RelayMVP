import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { companies } from "../../../../db/schema";
import { sameOrigin } from "../_utils";

const currencies = new Set(["KZT", "RUB", "USD", "EUR"]);

function amount(value: unknown, maximum = 1_000_000_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(parsed)));
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const currency = String(body.currency || company.crmGoalCurrency || "KZT").toUpperCase();
    if (!currencies.has(currency)) throw new Error("Эта валюта пока не поддерживается");
    const values = {
      crmMonthlyGoal: amount(body.monthlyGoal),
      crmAverageCheck: amount(body.averageCheck),
      crmConversionRate: amount(body.conversionRate, 100),
      crmLeadsPerAmbassador: amount(body.leadsPerAmbassador, 100_000),
      crmGoalCurrency: currency,
      updatedAt: new Date().toISOString(),
    };
    await getDb().update(companies).set(values).where(eq(companies.id, company.id));
    return Response.json({ ok: true, settings: values });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить цель" }, { status: 400 });
  }
}
