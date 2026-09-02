import { sendCompanyApplicationNotification } from "../../../../lib/agent-email";
import { cleanString, sameOrigin } from "../../company/_utils";
import { getDb } from "@/db";
import { marketingEvents } from "@/db/schema";

function utm(value: unknown) { return cleanString(value, 120); }

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Проверьте данные формы" }, { status: 400 });

  // Quietly accept bot-filled forms without sending email.
  if (cleanString(body.website, 200)) return Response.json({ ok: true });

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
    await sendCompanyApplicationNotification(application);
    await getDb().insert(marketingEvents).values({ id: crypto.randomUUID(), event: "company_application_submitted", path: "/", utmSource: utm(body.utmSource), utmMedium: utm(body.utmMedium), utmCampaign: utm(body.utmCampaign) });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось отправить заявку" }, { status: 503 });
  }
}
