import { getPartnerKnowledgeFile } from "../../../../../db/partner";
import { getFilesBucket } from "../../../../../lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";
  const item = await getPartnerKnowledgeFile(token, id);
  if (!item?.objectKey) return new Response("Файл не найден", { status: 404 });
  const object = await getFilesBucket().get(item.objectKey);
  if (!object) return new Response("Файл не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": item.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.fileName || "material")}`, "cache-control": "private, no-store" } });
}
