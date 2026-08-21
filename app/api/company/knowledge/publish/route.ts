import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { companyKnowledgeItems } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const payload = await request.json() as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 8) return Response.json({ error: "Нет материалов для публикации" }, { status: 400 });
  const now = new Date().toISOString();
  const items = payload.items.map((item, index) => ({ id: crypto.randomUUID(), companyId: company.id, kind: ["SCRIPT", "GUIDE", "CASE"].includes(String(item.kind)) ? String(item.kind) : "GUIDE", title: cleanString(item.title, 120), content: cleanString(item.content, 5000), externalUrl: null, objectKey: null, fileName: null, mimeType: "application/octet-stream", size: 0, status: "PUBLISHED", sortOrder: index, createdAt: now, updatedAt: now })).filter((item) => item.title.length >= 3 && item.content.length >= 10);
  if (!items.length) return Response.json({ error: "Заполните названия и тексты" }, { status: 400 });
  await getDb().insert(companyKnowledgeItems).values(items);
  return Response.json({ items }, { status: 201 });
}
