import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { getConfirmedCompanyProfile, getLatestCompanyProfile } from "../../../../../db/profile";
import { getProgramForCompany } from "../../../../../db/programs";
import { companies } from "../../../../../db/schema";
import { generateStructuredJson } from "../../../../../lib/ai";
import { aiCreditLimit, calculateAiCredits, minimumAiCredits } from "../../../../../lib/ai-credits";
import { DEFAULT_SUBMISSION_FORM_FIELDS, normalizeSubmissionFormFields, SUBMISSION_FIELD_TYPES } from "../../../../../lib/submission-form";
import { cleanString, sameOrigin } from "../../../company/_utils";

const MISSION_TYPES = new Set(["LEAD", "DEAL", "IMAGE", "ENGAGEMENT"]);
const typeRoles: Record<string, string> = {
  LEAD: "Ты руководитель B2B-лидогенерации. Создай задание на знакомство с конкретным ICP, согласие на передачу контакта, квалификацию и проверку дубля.",
  DEAL: "Ты руководитель партнёрских продаж. Создай задание на подтверждаемый коммерческий этап: договор, оплата, подписка или согласованная встреча с ЛПР.",
  IMAGE: "Ты бренд-менеджер. Создай задание на полезную публикацию, кейс, отзыв или упоминание. Не привязывай его к передаче лида.",
  ENGAGEMENT: "Ты комьюнити-менеджер. Создай задание на обучение, мероприятие, тест, опрос или продуктовую активность. Не начисляй ценность за бессмысленные клики.",
};
const angles: Record<string, string[]> = {
  LEAD: ["точечное знакомство с ЛПР", "выход в новую отрасль", "квалифицированная рекомендация", "поиск компании по триггеру покупки"],
  DEAL: ["первая оплаченная подписка", "подписанный договор", "проведённая демонстрация с подтверждённым следующим шагом", "расширение действующего клиента"],
  IMAGE: ["практический кейс", "экспертный разбор", "честный отзыв", "публичное упоминание с пользой для аудитории"],
  ENGAGEMENT: ["продуктовый квиз", "участие в событии", "полевой чек-лист", "короткое обучение с проверяемым результатом"],
};

type GeneratedMission = { title: string; description: string; instructions: string[]; proofRequirements: string[]; rewardMode: string; rewardValue: number; rewardLabel: string; verificationRules: string };

const missionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" }, description: { type: "string" },
    instructions: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
    proofRequirements: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    rewardMode: { type: "string", enum: ["FIXED", "PERCENT", "POINTS", "NON_MONETARY"] },
    rewardValue: { type: "integer", minimum: 0 }, rewardLabel: { type: "string" }, verificationRules: { type: "string" },
  },
  required: ["title", "description", "instructions", "proofRequirements", "rewardMode", "rewardValue", "rewardLabel", "verificationRules"],
};

const fieldSchema = {
  type: "object", additionalProperties: false,
  properties: {
    stage: { type: "string", enum: ["CONTACT", "CONTEXT"] },
    type: { type: "string", enum: [...SUBMISSION_FIELD_TYPES] },
    scope: { type: "string", enum: ["ALL", "COMMERCIAL", "NON_COMMERCIAL"] },
    semantic: { type: "string", enum: ["CONTACT_NAME", "CONTACT_COMPANY", "CONTACT_EMAIL", "CONTACT_PHONE", "COMMENT", "LINKS", "FILES", "CUSTOM"] },
    label: { type: "string" }, description: { type: "string" }, placeholder: { type: "string" }, required: { type: "boolean" },
    options: { type: "array", maxItems: 12, items: { type: "string" } },
  },
  required: ["stage", "type", "scope", "semantic", "label", "description", "placeholder", "required", "options"],
};

function safeMission(raw: GeneratedMission) {
  const rewardMode = ["FIXED", "PERCENT", "POINTS", "NON_MONETARY"].includes(raw.rewardMode) ? raw.rewardMode : "FIXED";
  return {
    title: cleanString(raw.title, 120), description: cleanString(raw.description, 1200),
    instructions: (raw.instructions ?? []).map((value) => cleanString(value, 240)).filter(Boolean).slice(0, 6),
    proofRequirements: (raw.proofRequirements ?? []).map((value) => cleanString(value, 240)).filter(Boolean).slice(0, 5),
    rewardMode, rewardValue: Math.max(0, Math.min(100000000, Math.round(Number(raw.rewardValue) || 0))),
    rewardLabel: cleanString(raw.rewardLabel, 120), verificationRules: cleanString(raw.verificationRules, 1200),
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const { id } = await params;
  const program = await getProgramForCompany(company.id, id);
  if (!program) return Response.json({ error: "Программа не найдена" }, { status: 404 });
  if (company.aiTokenBalance < minimumAiCredits("PROGRAM_GENERATION")) return Response.json({ error: "Недостаточно AI-кредитов для генерации" }, { status: 402 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = cleanString(payload.action, 20);
    const profile = await getConfirmedCompanyProfile(company.id) ?? await getLatestCompanyProfile(company.id);
    const variationSeed = `${Date.now()}-${crypto.randomUUID()}`;
    const context = {
      company: { name: company.name, industry: company.industry, businessDescription: profile?.businessDescription ?? "", products: profile?.products ?? [], targetAudience: profile?.targetAudience ?? "", advantages: profile?.advantages ?? [], buyingTriggers: profile?.buyingTriggers ?? [], disqualifiers: profile?.disqualifiers ?? [], geographies: profile?.geographies ?? [] },
      program: { name: program.name, description: program.description, goal: program.goal, currency: program.currency },
    };

    let result: { data: unknown; inputTokens: number; outputTokens: number; thoughtsTokens?: number };
    let responseData: Record<string, unknown>;

    if (action === "MISSION") {
      const missionType = cleanString(payload.missionType, 20);
      if (!MISSION_TYPES.has(missionType)) throw new Error("Выберите тип задания");
      const existing = program.missions.map((mission) => ({ type: mission.type, title: mission.title, description: mission.description, instructions: mission.instructions, proof: mission.proofRequirements }));
      const angleList = angles[missionType];
      const angle = angleList[Math.abs(Date.now() + existing.length) % angleList.length];
      const ai = await generateStructuredJson<GeneratedMission>({
        systemInstruction: `${typeRoles[missionType]} Ты проектируешь задания для агентской сети Relay. Пиши по-русски, конкретно и без выдуманных фактов. Все поля должны быть полностью заполнены и оставаться удобными для ручного редактирования.`,
        prompt: JSON.stringify({ task: "Создай один новый вариант задания. Он должен заметно отличаться от списка existing: другая цель действия, формулировки, последовательность шагов и способ подтверждения. Не копируй названия и предложения. Вознаграждение должно соответствовать типу задания и валюте программы.", variationSeed, creativeAngle: angle, ...context, missionType, existing }),
        schema: missionSchema, maxOutputTokens: 1000, thinkingLevel: "low", temperature: 0.85,
      });
      result = ai; responseData = { mission: safeMission(ai.data) };
    } else if (action === "FORM") {
      const schema = { type: "object", additionalProperties: false, properties: { fields: { type: "array", minItems: 7, maxItems: 14, items: fieldSchema } }, required: ["fields"] };
      const ai = await generateStructuredJson<{ fields: Array<Record<string, unknown>> }>({
        systemInstruction: "Ты UX-методолог Relay. Собери короткую форму передачи результата: только данные, которые реально нужны компании для проверки. Сохрани системные semantic-поля CONTACT_NAME, CONTACT_COMPANY, CONTACT_EMAIL, CONTACT_PHONE, COMMENT, LINKS, FILES ровно по одному. Добавь не более 4 CUSTOM-полей. Для лидов и сделок используй scope COMMERCIAL, для имиджа и вовлечения NON_COMMERCIAL, для общих подтверждений ALL. Пиши понятные русские названия, подсказки и примеры.",
        prompt: JSON.stringify({ task: "Предложи полную форму результата для этой программы с учётом всех заданий. Не спрашивай данные, которые не используются при проверке.", variationSeed, ...context, missions: program.missions }),
        schema, maxOutputTokens: 1500, thinkingLevel: "low", temperature: 0.7,
      });
      result = ai;
      const fields = normalizeSubmissionFormFields(ai.data.fields.map((field, index) => ({ ...field, id: field.semantic === "CUSTOM" ? `custom-${crypto.randomUUID()}` : DEFAULT_SUBMISSION_FORM_FIELDS.find((item) => item.semantic === field.semantic)?.id, sortOrder: index })));
      responseData = { formFields: fields };
    } else if (action === "FIELD") {
      const requestedType = SUBMISSION_FIELD_TYPES.includes(payload.type as never) ? payload.type : "TEXT";
      const ai = await generateStructuredJson<Record<string, unknown>>({
        systemInstruction: "Ты UX-методолог Relay. Придумай одно полезное поле формы проверки результата. Оно должно собирать только информацию, которая помогает компании принять или отклонить результат. semantic всегда CUSTOM. Пиши коротко и по-русски.",
        prompt: JSON.stringify({ task: "Заполни название, описание, пример и обязательность нового поля. Сохрани выбранные stage, type и scope.", variationSeed, ...context, requested: { stage: payload.stage, type: requestedType, scope: payload.scope }, existingFields: program.formFields }),
        schema: fieldSchema, maxOutputTokens: 500, thinkingLevel: "minimal", temperature: 0.75,
      });
      result = ai;
      const field = normalizeSubmissionFormFields([{ ...ai.data, id: `custom-${crypto.randomUUID()}`, semantic: "CUSTOM", stage: payload.stage, type: requestedType, scope: payload.scope, sortOrder: 99 }]).find((item) => item.semantic === "CUSTOM");
      responseData = { field };
    } else throw new Error("Неизвестное действие Yaler");

    const spent = Math.min(company.aiTokenBalance, calculateAiCredits("PROGRAM_GENERATION", result, 1));
    await getDb().update(companies).set({ aiTokenBalance: sql`max(${companies.aiTokenBalance} - ${spent}, 0)`, aiTokensUsed: sql`${companies.aiTokensUsed} + ${spent}`, updatedAt: new Date().toISOString() }).where(eq(companies.id, company.id));
    return Response.json({ ...responseData, creditsSpent: spent, tokenBalance: Math.max(0, company.aiTokenBalance - spent), creditLimit: aiCreditLimit("PROGRAM_GENERATION", 1) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Yaler не смог подготовить вариант" }, { status: 400 });
  }
}
