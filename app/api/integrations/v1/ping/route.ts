import { authenticateApiKey } from "@/lib/integrations/service";
import { apiError, apiJson } from "../_response";

export async function GET(request: Request) {
  const access = await authenticateApiKey(request, "integrations:read");
  if (!access) return apiError("Проверьте API-ключ и его разрешения", 401, "UNAUTHORIZED");
  return apiJson({ ok: true, apiVersion: "v1", companyId: access.companyId, checkedAt: new Date().toISOString() });
}
