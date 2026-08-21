import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { companyMethodologyBriefs } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../_utils";

const allowedChannels = new Set(["WHATSAPP", "CALL", "MEETING", "EMAIL", "SOCIAL"]);

function cleanChannels(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(String).filter((channel) => allowedChannels.has(channel)))].slice(0, 5)
    : [];
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const values = {
      companyId: company.id,
      offer: cleanString(payload.offer, 1200),
      idealCustomer: cleanString(payload.idealCustomer, 1200),
      decisionMakers: cleanString(payload.decisionMakers, 800),
      customerProblems: cleanString(payload.customerProblems, 1600),
      salesGoal: cleanString(payload.salesGoal, 500),
      nextStep: cleanString(payload.nextStep, 500),
      channelsJson: JSON.stringify(cleanChannels(payload.channels)),
      tone: cleanString(payload.tone, 120) || "Деловой и человеческий",
      proofPoints: cleanString(payload.proofPoints, 1600),
      mustSay: cleanString(payload.mustSay, 1200),
      mustNotSay: cleanString(payload.mustNotSay, 1200),
      language: cleanString(payload.language, 40) || "Русский",
      updatedAt: new Date().toISOString(),
    };
    if (!values.offer || !values.idealCustomer || !values.nextStep) {
      return Response.json({ error: "Заполните предложение, идеального клиента и следующий шаг" }, { status: 400 });
    }
    await getDb().insert(companyMethodologyBriefs).values(values).onConflictDoUpdate({
      target: companyMethodologyBriefs.companyId,
      set: values,
    });
    return Response.json({ brief: { ...values, channels: JSON.parse(values.channelsJson) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить бриф" }, { status: 400 });
  }
}
