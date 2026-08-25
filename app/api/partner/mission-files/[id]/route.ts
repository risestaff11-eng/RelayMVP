import { getPartnerMissionResource } from "../../../../../db/partner";
import { getFilesBucket } from "../../../../../lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";
  const resource = await getPartnerMissionResource(token, id);
  if (!resource) return new Response("Файл не найден", { status: 404 });
  const object = await getFilesBucket().get(resource.objectKey);
  if (!object) return new Response("Файл не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": resource.mimeType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`, "cache-control": "private, no-store" } });
}
