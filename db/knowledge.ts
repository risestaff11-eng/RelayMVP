import { and, asc, eq } from "drizzle-orm";
import { getDb } from ".";
import { companyKnowledgeItems, companyMethodologyBriefs } from "./schema";

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type MethodologyBrief = {
  offer: string;
  idealCustomer: string;
  decisionMakers: string;
  customerProblems: string;
  salesGoal: string;
  nextStep: string;
  channels: string[];
  tone: string;
  proofPoints: string;
  mustSay: string;
  mustNotSay: string;
  language: string;
};

export const EMPTY_METHODOLOGY_BRIEF: MethodologyBrief = {
  offer: "",
  idealCustomer: "",
  decisionMakers: "",
  customerProblems: "",
  salesGoal: "Получить квалифицированную рекомендацию",
  nextStep: "Организовать знакомство с представителем компании",
  channels: ["WHATSAPP", "CALL", "MEETING"],
  tone: "Деловой и человеческий",
  proofPoints: "",
  mustSay: "",
  mustNotSay: "",
  language: "Русский",
};

export async function getCompanyMethodologyBrief(companyId: string): Promise<MethodologyBrief> {
  const row = (await getDb().select().from(companyMethodologyBriefs).where(eq(companyMethodologyBriefs.companyId, companyId)).limit(1))[0];
  if (!row) return EMPTY_METHODOLOGY_BRIEF;
  return {
    offer: row.offer,
    idealCustomer: row.idealCustomer,
    decisionMakers: row.decisionMakers,
    customerProblems: row.customerProblems,
    salesGoal: row.salesGoal,
    nextStep: row.nextStep,
    channels: parseList(row.channelsJson),
    tone: row.tone,
    proofPoints: row.proofPoints,
    mustSay: row.mustSay,
    mustNotSay: row.mustNotSay,
    language: row.language,
  };
}

export async function getCompanyKnowledge(companyId: string, publishedOnly = false) {
  return getDb().select().from(companyKnowledgeItems)
    .where(publishedOnly ? and(eq(companyKnowledgeItems.companyId, companyId), eq(companyKnowledgeItems.status, "PUBLISHED")) : eq(companyKnowledgeItems.companyId, companyId))
    .orderBy(asc(companyKnowledgeItems.sortOrder), asc(companyKnowledgeItems.createdAt));
}
