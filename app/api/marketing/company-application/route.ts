import { cleanString, sameOrigin } from "../../company/_utils";
import { getDb } from "@/db";
import { companyApplications, marketingEvents } from "@/db/schema";
import { deliverCompanyApplicationNotification } from "@/lib/company-application-service";
import { limitPublicSubmission, requestLimitResponse } from "@/lib/request-rate-limit";

function utm(value: unknown) { return cleanString(value, 120); }

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Проверьте данные формы" }, { status: 400 });

  // Quietly accept bot-filled forms without sending email.
  if (cleanString(body.website, 200)) return Response.json({ ok: true });
  try { await limitPublicSubmission(request); } catch (error) { return requestLimitResponse(error) ?? Response.json({ error: "Не удалось проверить лимит отправок" }, { status: 503 }); }

  const application = {
    name: cleanString(body.name, 100),
    company: cleanString(body.company, 140),
    email: cleanString(body.email, 180).toLowerCase(),
    phone: cleanString(body.phone, 40),
    comment: cleanString(body.comment, 700),
  };

  if (!application.name || !application.company || !application.phone) {
    return Response.json({ error: "Укажите имя, компанию и телефон" }, { status: 400 });
  }
  if (application.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) {
    return Response.json({ error: "Проверьте email" }, { status: 400 });
  }

  try {
    const suppliedId = cleanString(body.applicationId, 80);
    const applicationId = /^[a-zA-Z0-9-]{16,80}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
    const visitId = cleanString(body.visitId, 80);
    const firstUtmSource = utm(body.firstUtmSource ?? body.utmSource);
    const firstUtmMedium = utm(body.firstUtmMedium ?? body.utmMedium);
    const firstUtmCampaign = utm(body.firstUtmCampaign ?? body.utmCampaign);
    const lastUtmSource = utm(body.lastUtmSource ?? body.utmSource);
    const lastUtmMedium = utm(body.lastUtmMedium ?? body.utmMedium);
    const lastUtmCampaign = utm(body.lastUtmCampaign ?? body.utmCampaign);
    const now = new Date().toISOString();
    const db = getDb();
    await db.batch([
      db.insert(companyApplications).values({ id: applicationId, visitId, ...application, firstUtmSource, firstUtmMedium, firstUtmCampaign, lastUtmSource, lastUtmMedium, lastUtmCampaign, nextNotificationAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing(),
      db.insert(marketingEvents).values({ id: `company-application:${applicationId}`, event: "company_application_submitted", path: "/", visitId, utmSource: firstUtmSource, utmMedium: firstUtmMedium, utmCampaign: firstUtmCampaign, lastUtmSource, lastUtmMedium, lastUtmCampaign, createdAt: now }).onConflictDoNothing(),
    ]);
    const notificationSent = await deliverCompanyApplicationNotification(applicationId);
    return Response.json({ ok: true, applicationId, notificationSent }, { status: notificationSent ? 201 : 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить заявку" }, { status: 503 });
  }
}
