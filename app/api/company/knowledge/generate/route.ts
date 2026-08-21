import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { getLatestCompanyProfile } from "../../../../../db/profile";
import { companies } from "../../../../../db/schema";
import { generateStructuredJson } from "../../../../../lib/ai";
import { calculateAiCredits, minimumAiCredits } from "../../../../../lib/ai-credits";
import { sameOrigin } from "../../_utils";

type Draft = { kind: "SCRIPT" | "GUIDE" | "CASE"; title: string; content: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (company.aiTokenBalance < minimumAiCredits("KNOWLEDGE_GENERATION")) return Response.json({ error: "Недостаточно AI-кредитов" }, { status: 400 });
  try {
    const profile = await getLatestCompanyProfile(company.id);
    const ai = await generateStructuredJson<{ items: Draft[] }>({
      systemInstruction: "Ты B2B-методолог Relay. Создай практичные материалы только из переданных фактов. Не выдумывай цены, гарантии и кейсы. Дай готовый скрипт первого знакомства, инструкцию квалификации клиента и памятку по возражениям. Пиши коротко, конкретно, на русском.",
      prompt: JSON.stringify({ company: { name: company.name, industry: company.industry, website: company.website }, profile }),
      schema: { type: "object", additionalProperties: false, properties: { items: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["SCRIPT", "GUIDE", "CASE"] }, title: { type: "string" }, content: { type: "string" } }, required: ["kind", "title", "content"] } } }, required: ["items"] },
      maxOutputTokens: 1600,
      thinkingLevel: "low",
    });
    const spent = Math.min(company.aiTokenBalance, calculateAiCredits("KNOWLEDGE_GENERATION", ai));
    await getDb().update(companies).set({ aiTokenBalance: sql`max(${companies.aiTokenBalance} - ${spent}, 0)`, aiTokensUsed: sql`${companies.aiTokensUsed} + ${spent}`, updatedAt: new Date().toISOString() }).where(eq(companies.id, company.id));
    return Response.json({ items: ai.data.items, tokenBalance: company.aiTokenBalance - spent, creditsSpent: spent });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать материалы" }, { status: 400 }); }
}
