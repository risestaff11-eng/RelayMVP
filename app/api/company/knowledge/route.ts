import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { companyKnowledgeItems } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { cleanString, sameOrigin } from "../_utils";

const kinds = new Set(["OFFER", "ICP", "SCRIPT", "DISCOVERY", "OBJECTION", "PROCESS", "FOLLOW_UP", "FAQ", "CASE", "CHECKLIST", "COMPLIANCE", "LINK", "FILE"]);
const channels = new Set(["ALL", "WHATSAPP", "CALL", "MEETING", "EMAIL", "SOCIAL"]);
const salesStages = new Set(["PREPARE", "OUTREACH", "QUALIFY", "PRESENT", "FOLLOW_UP", "CLOSE"]);

function stringList(value: FormDataEntryValue | null, limit = 8) {
  if (typeof value !== "string") return [];
  return value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const form = await request.formData();
    const title = cleanString(form.get("title"), 120);
    const summary = cleanString(form.get("summary"), 300);
    const content = cleanString(form.get("content"), 5000);
    const agentAction = cleanString(form.get("agentAction"), 500);
    const audience = cleanString(form.get("audience"), 500);
    const channelRaw = cleanString(form.get("channel"), 20);
    const salesStageRaw = cleanString(form.get("salesStage"), 20);
    const externalUrl = cleanString(form.get("externalUrl"), 500);
    const kindRaw = cleanString(form.get("kind"), 20);
    const kind = kinds.has(kindRaw) ? kindRaw : "PROCESS";
    const channel = channels.has(channelRaw) ? channelRaw : "ALL";
    const salesStage = salesStages.has(salesStageRaw) ? salesStageRaw : "PREPARE";
    if (title.length < 3) throw new Error("Укажите понятное название материала");
    if (externalUrl && !/^https?:\/\//i.test(externalUrl)) throw new Error("Ссылка должна начинаться с http:// или https://");
    const file = form.get("file");
    let objectKey: string | null = null;
    let fileName: string | null = null;
    let mimeType = "application/octet-stream";
    let size = 0;
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024) throw new Error("Файл должен быть не больше 10 МБ");
      objectKey = `${company.id}/knowledge/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await getFilesBucket().put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || mimeType } });
      fileName = cleanString(file.name, 180); mimeType = file.type || mimeType; size = file.size;
    }
    if (!content && !externalUrl && !objectKey) throw new Error("Добавьте текст, ссылку или файл");
    const now = new Date().toISOString();
    const item = { id: crypto.randomUUID(), companyId: company.id, kind, title, summary, content, agentAction, channel, salesStage, audience, sourceBasisJson: JSON.stringify(stringList(form.get("sourceBasis"))), warningsJson: "[]", externalUrl: externalUrl || null, objectKey, fileName, mimeType, size, status: "PUBLISHED", sortOrder: 0, createdAt: now, updatedAt: now };
    await getDb().insert(companyKnowledgeItems).values(item);
    return Response.json({ item }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Не удалось сохранить материал" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = cleanString(payload.id, 80);
    const row = (await getDb().select().from(companyKnowledgeItems).where(and(eq(companyKnowledgeItems.id, id), eq(companyKnowledgeItems.companyId, company.id))).limit(1))[0];
    if (!row) return Response.json({ error: "Материал не найден" }, { status: 404 });
    const kindRaw = cleanString(payload.kind, 20);
    const channelRaw = cleanString(payload.channel, 20);
    const salesStageRaw = cleanString(payload.salesStage, 20);
    const title = cleanString(payload.title, 120);
    const content = cleanString(payload.content, 5000);
    if (title.length < 3 || (!content && !row.externalUrl && !row.objectKey)) throw new Error("Заполните название и содержание материала");
    await getDb().update(companyKnowledgeItems).set({
      kind: kinds.has(kindRaw) ? kindRaw : row.kind,
      title,
      summary: cleanString(payload.summary, 300),
      content,
      agentAction: cleanString(payload.agentAction, 500),
      audience: cleanString(payload.audience, 500),
      channel: channels.has(channelRaw) ? channelRaw : row.channel,
      salesStage: salesStages.has(salesStageRaw) ? salesStageRaw : row.salesStage,
      status: payload.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      updatedAt: new Date().toISOString(),
    }).where(eq(companyKnowledgeItems.id, row.id));
    const item = (await getDb().select().from(companyKnowledgeItems).where(eq(companyKnowledgeItems.id, row.id)).limit(1))[0];
    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить материал" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const row = (await getDb().select().from(companyKnowledgeItems).where(and(eq(companyKnowledgeItems.id, id), eq(companyKnowledgeItems.companyId, company.id))).limit(1))[0];
  if (!row) return Response.json({ error: "Материал не найден" }, { status: 404 });
  if (row.objectKey) await getFilesBucket().delete(row.objectKey);
  await getDb().delete(companyKnowledgeItems).where(eq(companyKnowledgeItems.id, row.id));
  return Response.json({ ok: true });
}
