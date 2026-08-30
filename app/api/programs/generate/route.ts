import { and, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { getConfirmedCompanyProfile, getLatestCompanyProfile } from "../../../../db/profile";
import { companies, missions, programs } from "../../../../db/schema";
import { generateStructuredJson } from "../../../../lib/ai";
import { aiCreditLimit, calculateAiCredits, minimumAiCredits } from "../../../../lib/ai-credits";
import { cleanString, sameOrigin } from "../../company/_utils";

const MISSION_TYPES = new Set(["LEAD", "DEAL", "IMAGE", "ENGAGEMENT"]);
const GOALS = new Set(["LEADS", "DEALS", "BRAND", "ENGAGEMENT", "MIXED"]);
const CURRENCIES = new Set(["KZT", "RUB", "USD", "EUR"]);

const manualTemplates: Record<string, Omit<GeneratedMission, "type">> = {
  LEAD: { title: "Новое задание на знакомство", description: "Опишите, какого потенциального клиента должен найти агент.", instructions: ["Найдите подходящего клиента", "Получите согласие на знакомство"], proofRequirements: ["Контактные данные и комментарий"], rewardMode: "FIXED", rewardValue: 0, rewardLabel: "Укажите награду", verificationRules: "Опишите критерии принятия результата." },
  DEAL: { title: "Новое задание на сделку", description: "Опишите коммерческий результат, за который начисляется награда.", instructions: ["Организуйте знакомство", "Сопроводите клиента до результата"], proofRequirements: ["Подтверждение договора или оплаты"], rewardMode: "PERCENT", rewardValue: 0, rewardLabel: "Укажите процент или сумму", verificationRules: "Опишите критерии подтверждения сделки." },
  IMAGE: { title: "Новое имиджевое задание", description: "Опишите публикацию, кейс, отзыв или упоминание.", instructions: ["Подготовьте материал", "Опубликуйте его на выбранной площадке"], proofRequirements: ["Ссылка или скриншот публикации"], rewardMode: "FIXED", rewardValue: 0, rewardLabel: "Укажите награду", verificationRules: "Опишите требования к материалу и проверке." },
  ENGAGEMENT: { title: "Новое задание на вовлечение", description: "Опишите обучение, мероприятие, тест или полезную активность.", instructions: ["Выполните указанную активность"], proofRequirements: ["Подтверждение выполнения"], rewardMode: "NON_MONETARY", rewardValue: 0, rewardLabel: "Укажите результат или бонус", verificationRules: "Опишите критерии завершения активности." },
};

type GeneratedMission = {
  type: string;
  title: string;
  description: string;
  instructions: string[];
  proofRequirements: string[];
  rewardMode: string;
  rewardValue: number;
  rewardLabel: string;
  verificationRules: string;
};

type GeneratedProgram = { programDescription: string; payoutTerms: string; legalTerms: string; missions: GeneratedMission[] };

function slugPart(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "partner-program";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите в аккаунт" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const profile = await getConfirmedCompanyProfile(company.id) ?? await getLatestCompanyProfile(company.id);

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const name = cleanString(payload.name, 100);
    const goal = cleanString(payload.goal, 30);
    const currency = cleanString(payload.currency, 5);
    const mode = cleanString(payload.mode, 20) === "manual" ? "manual" : "ai";
    const selectedTypes = Array.isArray(payload.missionTypes) ? [...new Set(payload.missionTypes.map((value) => cleanString(value, 20)))] : [];
    if (name.length < 3) throw new Error("Название программы должно содержать минимум 3 символа");
    if (!GOALS.has(goal)) throw new Error("Выберите цель программы");
    if (!CURRENCIES.has(currency)) throw new Error("Выберите валюту вознаграждений");
    if (selectedTypes.length < 1 || selectedTypes.length > 4 || selectedTypes.some((type) => !MISSION_TYPES.has(type))) throw new Error("Выберите от одного до четырёх типов заданий");
    if (mode === "ai" && company.aiTokenBalance < minimumAiCredits("PROGRAM_GENERATION")) throw new Error("Недостаточно AI-кредитов для генерации программы");

    const db = getDb();
    const duplicate = await db.select({ id: programs.id }).from(programs).where(and(eq(programs.companyId, company.id), eq(programs.name, name))).limit(1);
    if (duplicate[0]) throw new Error("Программа с таким названием уже существует. Уточните назначение, например «Лиды на ипотеку» или «Закрытые сделки».");
    if (mode === "manual") {
      const programId = crypto.randomUUID();
      const slug = `${slugPart(name)}-${crypto.randomUUID().slice(0, 7)}`;
      const now = new Date().toISOString();
      await db.batch([
        db.insert(programs).values({ id: programId, companyId: company.id, profileVersionId: profile?.id ?? null, name, slug, description: "Опишите, что предлагает компания и кому будет полезна программа.", goal, currency, payoutTerms: "Укажите срок и порядок выплаты после подтверждения результата.", legalTerms: "Запрещены спам, ложные обещания и передача контактов без согласия.", status: "DRAFT", createdAt: now, updatedAt: now }),
        db.insert(missions).values(selectedTypes.map((type, index) => { const mission = manualTemplates[type]; return { id: crypto.randomUUID(), programId, type, title: mission.title, description: mission.description, instructionsJson: JSON.stringify(mission.instructions), proofRequirementsJson: JSON.stringify(mission.proofRequirements), rewardMode: mission.rewardMode, rewardValue: mission.rewardValue, rewardLabel: mission.rewardLabel, verificationRules: mission.verificationRules, sortOrder: index, createdAt: now, updatedAt: now }; })),
        db.update(companies).set({ onboardingStatus: "PROGRAM_DRAFT", updatedAt: now }).where(eq(companies.id, company.id)),
      ]);
      return Response.json({ programId, tokenBalance: company.aiTokenBalance, creditsSpent: 0 }, { status: 201 });
    }
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        programDescription: { type: "string" },
        payoutTerms: { type: "string" },
        legalTerms: { type: "string" },
        missions: {
          type: "array",
          minItems: selectedTypes.length,
          maxItems: selectedTypes.length,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: selectedTypes },
              title: { type: "string" },
              description: { type: "string" },
              instructions: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
              proofRequirements: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
              rewardMode: { type: "string", enum: ["FIXED", "PERCENT", "POINTS", "NON_MONETARY"] },
              rewardValue: { type: "integer", minimum: 0 },
              rewardLabel: { type: "string" },
              verificationRules: { type: "string" },
            },
            required: ["type", "title", "description", "instructions", "proofRequirements", "rewardMode", "rewardValue", "rewardLabel", "verificationRules"],
          },
        },
      },
      required: ["programDescription", "payoutTerms", "legalTerms", "missions"],
    };

    const ai = await generateStructuredJson<GeneratedProgram>({
      systemInstruction: `Ты продуктовый архитектор агентских B2B-программ Relay. Создавай честные, выполнимые и готовые к редактированию задания для внешних агентов.
Для каждой плитки работай в отдельной роли:
- LEAD: руководитель лидогенерации. Опиши ICP, обязательные данные квалифицированного контакта, проверку дубля и критерий принятия.
- DEAL: руководитель партнёрских продаж. Привяжи результат к подтверждаемому этапу сделки или оплате, не обещай выплату до выполнения условия.
- IMAGE: бренд-менеджер. Требуй проверяемую публикацию, кейс, отзыв или упоминание с корректным раскрытием связи с компанией.
- ENGAGEMENT: комьюнити-менеджер. Предлагай полезное обучение, мероприятие, опрос или знакомство без бессмысленных кликов.
Для каждого задания сформируй: короткое название, ожидаемый результат, 2–6 шагов, доказательства, реалистичный черновик награды и однозначные правила проверки. Также подготовь пример общих сроков выплаты и пример правил публикации: запрет спама, ложных обещаний, выдачи себя за сотрудника и нарушения конфиденциальности. Это именно черновики — не выдумывай факты, цены и юридические гарантии. Если профиль неполный, используй нейтральные формулировки и явно оставляй компании возможность уточнить детали. Пиши по-русски, коротко и конкретно.`,
      prompt: JSON.stringify({
        task: "Создай ровно по одному заданию каждого выбранного типа в порядке missionTypes, а также готовые примеры общих сроков выплаты и правил публикации.",
        program: { name, goal, currency, missionTypes: selectedTypes },
        company: {
          name: company.name,
          industry: company.industry,
          profileStatus: profile?.status ?? "MISSING",
          businessDescription: profile?.businessDescription ?? "",
          products: profile?.products ?? [],
          targetAudience: profile?.targetAudience ?? "",
          advantages: profile?.advantages ?? [],
          buyingTriggers: profile?.buyingTriggers ?? [],
          disqualifiers: profile?.disqualifiers ?? [],
          geographies: profile?.geographies ?? [],
          partnerPitch: profile?.partnerPitch ?? "",
        },
      }),
      schema,
      maxOutputTokens: 950 + selectedTypes.length * 500,
      thinkingLevel: "low",
    });

    const byType = new Map(ai.data.missions.map((mission) => [mission.type, mission]));
    if (selectedTypes.some((type) => !byType.has(type)) || byType.size !== selectedTypes.length) throw new Error("Yaler подготовил неполный набор заданий. Повторите генерацию.");

    const programId = crypto.randomUUID();
    const slug = `${slugPart(name)}-${crypto.randomUUID().slice(0, 7)}`;
    const now = new Date().toISOString();
    const missionRows = selectedTypes.map((type, index) => {
      const mission = byType.get(type)!;
      return {
        id: crypto.randomUUID(),
        programId,
        type,
        title: cleanString(mission.title, 120),
        description: cleanString(mission.description, 1200),
        instructionsJson: JSON.stringify((mission.instructions ?? []).map((item) => cleanString(item, 240)).filter(Boolean).slice(0, 6)),
        proofRequirementsJson: JSON.stringify((mission.proofRequirements ?? []).map((item) => cleanString(item, 240)).filter(Boolean).slice(0, 5)),
        rewardMode: ["FIXED", "PERCENT", "POINTS", "NON_MONETARY"].includes(mission.rewardMode) ? mission.rewardMode : "FIXED",
        rewardValue: Math.max(0, Math.min(100000000, Math.round(Number(mission.rewardValue) || 0))),
        rewardLabel: cleanString(mission.rewardLabel, 120),
        verificationRules: cleanString(mission.verificationRules, 1200),
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      };
    });

    const spent = Math.min(company.aiTokenBalance, calculateAiCredits("PROGRAM_GENERATION", ai, selectedTypes.length));
    await db.batch([
      db.insert(programs).values({ id: programId, companyId: company.id, profileVersionId: profile?.id ?? null, name, slug, description: cleanString(ai.data.programDescription, 1800), goal, currency, payoutTerms: cleanString(ai.data.payoutTerms, 1800), legalTerms: cleanString(ai.data.legalTerms, 2400), status: "DRAFT", createdAt: now, updatedAt: now }),
      db.insert(missions).values(missionRows),
      db.update(companies).set({ aiTokenBalance: sql`max(${companies.aiTokenBalance} - ${spent}, 0)`, aiTokensUsed: sql`${companies.aiTokensUsed} + ${spent}`, onboardingStatus: "PROGRAM_DRAFT", updatedAt: now }).where(eq(companies.id, company.id)),
    ]);

    return Response.json({ programId, tokenBalance: Math.max(0, company.aiTokenBalance - spent), creditsSpent: spent, creditLimit: aiCreditLimit("PROGRAM_GENERATION", selectedTypes.length) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать программу";
    return Response.json({ error: message }, { status: 400 });
  }
}
