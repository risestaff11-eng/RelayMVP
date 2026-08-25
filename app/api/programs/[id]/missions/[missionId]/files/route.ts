import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../../../chatgpt-auth";
import { getDb } from "../../../../../../../db";
import { getCompanyForUser } from "../../../../../../../db/company";
import { missionResources, missions, programs } from "../../../../../../../db/schema";
import { getFilesBucket } from "../../../../../../../lib/storage";
import { cleanString, sameOrigin } from "../../../../../company/_utils";

async function context(programId: string, missionId: string) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const company = await getCompanyForUser(user.userId);
  if (!company) return null;
  const row = (await getDb().select({ missionId: missions.id }).from(missions)
    .innerJoin(programs, eq(missions.programId, programs.id))
    .where(and(eq(programs.id, programId), eq(programs.companyId, company.id), eq(missions.id, missionId))).limit(1))[0];
  return row ? company : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; missionId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const { id, missionId } = await params;
  const company = await context(id, missionId);
  if (!company) return Response.json({ error: "Задание не найдено" }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Выберите файл");
    if (file.size > 10 * 1024 * 1024) throw new Error("Файл должен быть не больше 10 МБ");
    const fileName = cleanString(file.name, 180) || "material";
    const mimeType = file.type || "application/octet-stream";
    const resourceId = crypto.randomUUID();
    const objectKey = `${company.id}/missions/${missionId}/${resourceId}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await getFilesBucket().put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: mimeType } });
    const resource = { id: resourceId, missionId, companyId: company.id, objectKey, fileName, mimeType, size: file.size, createdAt: new Date().toISOString() };
    await getDb().insert(missionResources).values(resource);
    return Response.json({ resource: { id: resource.id, fileName, mimeType, size: file.size } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить файл" }, { status: 400 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; missionId: string }> }) {
  const { id, missionId } = await params;
  const company = await context(id, missionId);
  if (!company) return new Response("Файл не найден", { status: 404 });
  const resourceId = new URL(request.url).searchParams.get("resource") || "";
  const row = (await getDb().select().from(missionResources).where(and(eq(missionResources.id, resourceId), eq(missionResources.missionId, missionId), eq(missionResources.companyId, company.id))).limit(1))[0];
  if (!row) return new Response("Файл не найден", { status: 404 });
  const object = await getFilesBucket().get(row.objectKey);
  if (!object) return new Response("Файл не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": row.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`, "cache-control": "private, no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; missionId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const { id, missionId } = await params;
  const company = await context(id, missionId);
  if (!company) return Response.json({ error: "Задание не найдено" }, { status: 404 });
  const resourceId = new URL(request.url).searchParams.get("resource") || "";
  const row = (await getDb().select().from(missionResources).where(and(eq(missionResources.id, resourceId), eq(missionResources.missionId, missionId), eq(missionResources.companyId, company.id))).limit(1))[0];
  if (!row) return Response.json({ error: "Файл не найден" }, { status: 404 });
  await getFilesBucket().delete(row.objectKey);
  await getDb().delete(missionResources).where(eq(missionResources.id, row.id));
  return Response.json({ ok: true });
}
