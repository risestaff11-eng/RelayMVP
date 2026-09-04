import { getD1 } from "@/db";
import { authenticateApiKey } from "@/lib/integrations/service";
import { apiError, apiJson } from "../_response";

export async function GET(request: Request) {
  const access = await authenticateApiKey(request, "agents:read");
  if (!access) return apiError("Проверьте API-ключ и его разрешения", 401, "UNAUTHORIZED");
  const agents = await getD1().prepare("SELECT id, program_id AS programId, name, email, phone, status, joined_at AS joinedAt, last_active_at AS lastActiveAt FROM partners WHERE company_id = ? AND status = 'ACTIVE' ORDER BY joined_at DESC")
    .bind(access.companyId).all<Record<string, unknown>>();
  return apiJson(agents.results);
}
