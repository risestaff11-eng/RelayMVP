import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../../db/company";
import { getCompanyReports } from "../../../../../db/reports";
import { generateStructuredJson } from "../../../../../lib/ai";
import { cleanString, sameOrigin } from "../../_utils";

type Analysis = { summary: string; trends: string[]; blockers: string[]; achievements: string[]; companyRecommendations: string[]; agentRecommendations: string[]; evidence: string[] };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 }); const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 }); const company = await getCompanyForUser(user.userId); if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try { const payload = await request.json() as Record<string, unknown>; const partnerId = cleanString(payload.partnerId, 80); const reports = (await getCompanyReports(company.id)).filter((item) => item.status !== "DRAFT" && (!partnerId || item.partnerId === partnerId)).slice(0, 12); if (!reports.length) throw new Error("Для анализа нужны отправленные отчёты");
    const context = reports.map((item) => ({ id: item.id, agent: item.partnerName, period: [item.periodStart, item.periodEnd], metrics: item.metrics, summary: item.aiSummary, answers: Object.fromEntries(Object.entries(item.answers).filter(([key]) => ["main_results", "wins", "blockers", "support", "next_plan", "comment"].includes(key))) }));
    const schema = { type: "object", additionalProperties: false, required: ["summary", "trends", "blockers", "achievements", "companyRecommendations", "agentRecommendations", "evidence"], properties: { summary: { type: "string" }, trends: { type: "array", items: { type: "string" } }, blockers: { type: "array", items: { type: "string" } }, achievements: { type: "array", items: { type: "string" } }, companyRecommendations: { type: "array", items: { type: "string" } }, agentRecommendations: { type: "array", items: { type: "string" } }, evidence: { type: "array", items: { type: "string" } } } };
    const ai = await generateStructuredJson<Analysis>({ systemInstruction: "Ты Yaler, аналитик регулярных отчётов агентов. Используй только переданные структурированные данные. Не придумывай факты, причины, значения или связи. Каждый вывод должен иметь проверяемое основание в evidence с ID отчёта или конкретной метрикой. Если данных недостаточно, прямо скажи об этом.", prompt: `Компания: ${company.name}. Проанализируй динамику без домыслов: ${JSON.stringify(context)}`, schema, maxOutputTokens: 2200 }); return Response.json({ analysis: ai.data });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось проанализировать отчёты" }, { status: 400 }); }
}
