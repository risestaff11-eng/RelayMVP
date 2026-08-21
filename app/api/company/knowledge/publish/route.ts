import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { getCompanyForUser } from "../../../../../db/company";
import { companyKnowledgeItems } from "../../../../../db/schema";
import { cleanString, sameOrigin } from "../../_utils";

const kinds = new Set(["OFFER", "ICP", "SCRIPT", "DISCOVERY", "OBJECTION", "PROCESS", "FOLLOW_UP", "FAQ", "CASE", "CHECKLIST", "COMPLIANCE"]);
const channels = new Set(["ALL", "WHATSAPP", "CALL", "MEETING", "EMAIL", "SOCIAL"]);
const stages = new Set(["PREPARE", "OUTREACH", "QUALIFY", "PRESENT", "FOLLOW_UP", "CLOSE"]);

function cleanList(value: unknown, limit: number) {
  return Array.isArray(value) ? value.map((item) => cleanString(item, 300)).filter(Boolean).slice(0, limit) : [];
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const payload = await request.json() as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 8) return Response.json({ error: "Нет материалов для публикации" }, { status: 400 });
  const now = new Date().toISOString();
  const items = payload.items.map((item, index) => {
    const kind = cleanString(item.kind, 20);
    const channel = cleanString(item.channel, 20);
    const salesStage = cleanString(item.salesStage, 20);
    return {
      id: crypto.randomUUID(),
      companyId: company.id,
      kind: kinds.has(kind) ? kind : "PROCESS",
      title: cleanString(item.title, 120),
      summary: cleanString(item.summary, 300),
      content: cleanString(item.content, 5000),
      agentAction: cleanString(item.agentAction, 500),
      channel: channels.has(channel) ? channel : "ALL",
      salesStage: stages.has(salesStage) ? salesStage : "PREPARE",
      audience: cleanString(item.audience, 500),
      sourceBasisJson: JSON.stringify(cleanList(item.sourceBasis, 5)),
      warningsJson: JSON.stringify(cleanList(item.warnings, 4)),
      externalUrl: null,
      objectKey: null,
      fileName: null,
      mimeType: "application/octet-stream",
      size: 0,
      status: "PUBLISHED",
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    };
  }).filter((item) => item.title.length >= 3 && item.content.length >= 40 && item.agentAction.length >= 5);
  if (!items.length) return Response.json({ error: "Заполните названия и тексты" }, { status: 400 });
  await getDb().insert(companyKnowledgeItems).values(items);
  return Response.json({ items }, { status: 201 });
}
