import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { companies } from "../../../../db/schema";
import { normalizeWebsite, sameOrigin } from "../_utils";
import { companyPermissionDenied, hasCompanyPermission } from "../../../../lib/company-permissions";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (!hasCompanyPermission(company.role, "COMPANY_SETTINGS_MANAGE")) return companyPermissionDenied();

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const websiteValue = typeof payload.website === "string" ? normalizeWebsite(payload.website.trim()) : null;
    const hasWhatsapp = Object.prototype.hasOwnProperty.call(payload, "contactWhatsapp");
    const hasInstagram = Object.prototype.hasOwnProperty.call(payload, "contactInstagram");
    const contactWhatsapp = hasWhatsapp && typeof payload.contactWhatsapp === "string" ? payload.contactWhatsapp.trim().slice(0, 40) : null;
    const contactInstagram = hasInstagram && typeof payload.contactInstagram === "string" ? payload.contactInstagram.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "").slice(0, 100) : null;
    const planCode = typeof payload.planCode === "string" ? payload.planCode : null;
    const hasReviewSla = Object.prototype.hasOwnProperty.call(payload, "reviewSlaHours");
    const hasPayoutSla = Object.prototype.hasOwnProperty.call(payload, "payoutSlaDays");
    const reviewSlaHours = Math.round(Number(payload.reviewSlaHours));
    const payoutSlaDays = Math.round(Number(payload.payoutSlaDays));
    if (!websiteValue && !planCode && !hasWhatsapp && !hasInstagram && !hasReviewSla && !hasPayoutSla) throw new Error("Нет данных для сохранения");
    if (contactWhatsapp && contactWhatsapp.replace(/\D/g, "").length < 7) throw new Error("Проверьте номер WhatsApp");
    if (contactInstagram && !/^[a-zA-Z0-9._]+$/.test(contactInstagram)) throw new Error("Укажите имя пользователя Instagram без пробелов");
    if (planCode) throw new Error("Автоматическая смена тарифа пока не подключена");
    if (hasReviewSla && (!Number.isSafeInteger(reviewSlaHours) || reviewSlaHours < 1 || reviewSlaHours > 336)) throw new Error("Срок проверки должен быть от 1 до 336 часов");
    if (hasPayoutSla && (!Number.isSafeInteger(payoutSlaDays) || payoutSlaDays < 1 || payoutSlaDays > 90)) throw new Error("Срок выплаты должен быть от 1 до 90 дней");

    const now = new Date().toISOString();
    const changes: Partial<typeof companies.$inferInsert> = { updatedAt: now };
    if (websiteValue) {
      changes.website = websiteValue;
      if (websiteValue !== company.website) changes.onboardingStatus = "WEBSITE_UPDATED";
    }
    if (hasWhatsapp) changes.contactWhatsapp = contactWhatsapp ?? "";
    if (hasInstagram) changes.contactInstagram = contactInstagram ?? "";
    if (hasReviewSla) changes.reviewSlaHours = reviewSlaHours;
    if (hasPayoutSla) changes.payoutSlaDays = payoutSlaDays;

    await getDb().update(companies).set(changes).where(eq(companies.id, company.id));
    return Response.json({
      website: websiteValue ?? company.website,
      contactWhatsapp: hasWhatsapp ? contactWhatsapp ?? "" : company.contactWhatsapp,
      contactInstagram: hasInstagram ? contactInstagram ?? "" : company.contactInstagram,
      planCode: planCode ?? company.planCode,
      aiTokenBalance: changes.aiTokenBalance ?? company.aiTokenBalance,
      reviewSlaHours: hasReviewSla ? reviewSlaHours : company.reviewSlaHours,
      payoutSlaDays: hasPayoutSla ? payoutSlaDays : company.payoutSlaDays,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить настройки";
    return Response.json({ error: message }, { status: 400 });
  }
}
