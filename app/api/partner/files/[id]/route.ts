import { getPartnerAttachment } from "../../../../../db/partner";
import { getFilesBucket } from "../../../../../lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { id } = await params;
  const attachment = await getPartnerAttachment(token, id);
  if (!attachment?.objectKey) return new Response("Файл не найден", { status: 404 });
  const object = await getFilesBucket().get(attachment.objectKey);
  if (!object) return new Response("Файл не найден", { status: 404 });
  const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";
  return new Response(object.body, { headers: { "content-type": attachment.mimeType, "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, "cache-control": "private, no-store" } });
}
