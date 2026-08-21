import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { getCompanyForUser } from "../../../../db/company";
import { companies } from "../../../../db/schema";
import { getFilesBucket } from "../../../../lib/storage";
import { sameOrigin } from "../_utils";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  const company = (await getDb().select({ logoObjectKey: companies.logoObjectKey }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company?.logoObjectKey) return new Response("Логотип не найден", { status: 404 });
  const object = await getFilesBucket().get(company.logoObjectKey);
  if (!object) return new Response("Логотип не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "image/webp", "cache-control": "public, max-age=3600" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const file = (await request.formData()).get("logo");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Выберите изображение" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024 || !allowed.has(file.type)) return Response.json({ error: "Логотип: JPG, PNG или WEBP до 5 МБ" }, { status: 400 });
  const objectKey = `${company.id}/brand/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bucket = getFilesBucket();
  await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  if (company.logoObjectKey) await bucket.delete(company.logoObjectKey);
  await getDb().update(companies).set({ logoObjectKey: objectKey, updatedAt: new Date().toISOString() }).where(eq(companies.id, company.id));
  return Response.json({ ok: true, logoUrl: `/api/company/logo?companyId=${company.id}` });
}
