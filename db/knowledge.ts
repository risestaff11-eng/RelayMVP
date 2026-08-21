import { and, asc, eq } from "drizzle-orm";
import { getDb } from ".";
import { companyKnowledgeItems } from "./schema";

export async function getCompanyKnowledge(companyId: string, publishedOnly = false) {
  return getDb().select().from(companyKnowledgeItems)
    .where(publishedOnly ? and(eq(companyKnowledgeItems.companyId, companyId), eq(companyKnowledgeItems.status, "PUBLISHED")) : eq(companyKnowledgeItems.companyId, companyId))
    .orderBy(asc(companyKnowledgeItems.sortOrder), asc(companyKnowledgeItems.createdAt));
}
