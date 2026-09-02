import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { getLatestCompanyProfile } from "../../../../db/profile";
import { getCompanyOperations, getProgramsForCompany } from "../../../../db/programs";
import { generateStructuredJson } from "../../../../lib/ai";
import { aiCreditLimit, calculateAiCredits, minimumAiCredits } from "../../../../lib/ai-credits";
import { reserveCompanyAiCredits, settleCompanyAiCredits } from "../../../../lib/company-credit-reservation";
import { cleanString, sameOrigin } from "../_utils";

type AssistantReply = {
  reply: string;
  suggestions: string[];
  action: {
    type: "NONE" | "CREATE_PROGRAM" | "UPDATE_PROGRAM" | "UPDATE_COMPANY_CONTACTS" | "UPDATE_PROFILE_DRAFT" | "OPEN_SECTION";
    label: string;
    summary: string;
    payload: {
      section?: string;
      programId?: string;
      name?: string;
      description?: string;
      payoutTerms?: string;
      legalTerms?: string;
      goal?: string;
      currency?: string;
      missionTypes?: string[];
      contactWhatsapp?: string;
      contactInstagram?: string;
      targetAudience?: string;
      partnerPitch?: string;
    };
  };
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (company.aiTokenBalance < minimumAiCredits("ASSISTANT_REPLY")) return Response.json({ error: "Недостаточно AI-кредитов для ответа. Пополните баланс в настройках." }, { status: 402 });

  try {
    const payload = await request.json() as { messages?: Array<{ role?: string; content?: string }> };
    const messages = (payload.messages ?? []).slice(-4).map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: cleanString(message.content, 700) })).filter((message) => message.content);
    if (!messages.length) return Response.json({ error: "Напишите вопрос или задачу" }, { status: 400 });
    const [profile, programs, operations] = await Promise.all([getLatestCompanyProfile(company.id), getProgramsForCompany(company.id), getCompanyOperations(company.id)]);
    const schema = {
      type: "object", additionalProperties: false,
      properties: {
        reply: { type: "string" },
        suggestions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
        action: {
          type: "object", additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["NONE", "CREATE_PROGRAM", "UPDATE_PROGRAM", "UPDATE_COMPANY_CONTACTS", "UPDATE_PROFILE_DRAFT", "OPEN_SECTION"] },
            label: { type: "string" },
            summary: { type: "string" },
            payload: {
              type: "object", additionalProperties: false,
              properties: {
                section: { type: "string" }, programId: { type: "string" }, name: { type: "string" }, description: { type: "string" }, payoutTerms: { type: "string" }, legalTerms: { type: "string" }, goal: { type: "string" }, currency: { type: "string" }, missionTypes: { type: "array", items: { type: "string", enum: ["LEAD", "DEAL", "IMAGE", "ENGAGEMENT"] } }, contactWhatsapp: { type: "string" }, contactInstagram: { type: "string" }, targetAudience: { type: "string" }, partnerPitch: { type: "string" },
              },
            },
          }, required: ["type", "label", "summary", "payload"],
        },
      }, required: ["reply", "suggestions", "action"],
    };
    const reservation = await reserveCompanyAiCredits(company.id, aiCreditLimit("ASSISTANT_REPLY"));
    if (!reservation) return Response.json({ error: "Недостаточно AI-кредитов для ответа. Попробуйте позже." }, { status: 402 });
    let ai: Awaited<ReturnType<typeof generateStructuredJson<AssistantReply>>>;
    try { ai = await generateStructuredJson<AssistantReply>({
      systemInstruction: `Ты — AI-агент RiseStaff и практический руководитель агентских B2B-продаж. Твоя зона ответственности: профиль компании, агентские программы, задания, награды, правила, публикации, привлечение и активация агентов, проверка результатов, выплаты и аналитика внутри RiseStaff.
Отвечай по-русски, конкретно: сначала вывод, затем 2–4 ближайших действия. Всегда учитывай реальные данные кабинета и не выдумывай факты. Предлагай только то, что можно сделать в RiseStaff.
Если вопрос не относится к RiseStaff или развитию агентской/амбассадорской сети, коротко и доброжелательно верни разговор к продукту: например «С этим не помогу, зато могу за две минуты собрать вам план запуска агентской сети в RiseStaff». Не развивай постороннюю тему.
Когда пользователь просит изменить данные, не утверждай, что изменение уже выполнено. Сформируй ровно одно безопасное действие для подтверждения. UPDATE_PROGRAM разрешён только для описания, сроков выплаты и правил; UPDATE_PROFILE_DRAFT — только для неподтверждённого черновика; CREATE_PROGRAM должен содержать название, цель, валюту и 1–4 типа заданий. OPEN_SECTION используй для перехода к результатам, агентам, выплатам, аналитике, профилю, базе знаний или настройкам; для базы знаний передавай section=knowledge. Если изменения не нужны, type=NONE.
Каждый ответ заканчивай конкретным следующим шагом или вопросом выбора.`,
      prompt: JSON.stringify({
        company: { id: company.id, name: company.name, website: company.website, industry: company.industry, goal: company.primaryGoal, tokens: company.aiTokenBalance, contacts: { whatsapp: company.contactWhatsapp, instagram: company.contactInstagram } },
        profile: profile ? { status: profile.status, targetAudience: cleanString(profile.targetAudience, 700), partnerPitch: cleanString(profile.partnerPitch, 500), products: profile.products.slice(0, 6), advantages: profile.advantages.slice(0, 5) } : null,
        operations,
        programs: programs.slice(0, 6).map((program) => ({ id: program.id, name: program.name, status: program.status, goal: program.goal, missions: program.missions.slice(0, 4).map((mission) => ({ type: mission.type, title: mission.title, reward: mission.rewardLabel })) })),
        conversation: messages,
      }), schema, maxOutputTokens: 850, thinkingLevel: "minimal",
    }); } catch (error) { await settleCompanyAiCredits(company.id, reservation.reserved, 0); throw error; }
    const spent = await settleCompanyAiCredits(company.id, reservation.reserved, calculateAiCredits("ASSISTANT_REPLY", ai));
    return Response.json({ ...ai.data, tokenBalance: reservation.balance + (reservation.reserved - spent), creditsSpent: spent, creditLimit: aiCreditLimit("ASSISTANT_REPLY") });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI-агент временно недоступен" }, { status: 400 });
  }
}
