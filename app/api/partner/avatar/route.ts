import { getPartnerPortal } from "../../../../db/partner";
import { getFilesBucket } from "../../../../lib/storage";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const portal = await getPartnerPortal(token);
  if (!portal?.profile.avatarObjectKey) return new Response("Аватар не найден", { status: 404 });
  const object = await getFilesBucket().get(portal.profile.avatarObjectKey);
  if (!object) return new Response("Аватар не найден", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "image/jpeg", "cache-control": "private, max-age=300" } });
}
