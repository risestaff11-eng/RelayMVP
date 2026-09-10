import { getD1 } from "@/db";
import { authenticateApiKey } from "@/lib/integrations/service";
import { apiError, apiJson } from "../_response";
import { limitIntegrationApi, requestLimitResponse } from "@/lib/request-rate-limit";

export async function GET(request: Request) {
  const access = await authenticateApiKey(request, "programs:read");
  if (!access) return apiError("Проверьте API-ключ и его разрешения", 401, "UNAUTHORIZED");
  try { await limitIntegrationApi(access.keyId, 300); } catch (error) { return requestLimitResponse(error) ?? apiError("Не удалось проверить лимит API", 503, "RATE_LIMIT_UNAVAILABLE"); }
  const rows = await getD1().prepare("SELECT p.id, p.name, p.slug, p.status, p.currency, p.updated_at AS updatedAt, m.id AS missionId, m.title AS missionTitle, m.type AS missionType, m.status AS missionStatus FROM programs p LEFT JOIN missions m ON m.program_id = p.id AND m.status = 'ACTIVE' WHERE p.company_id = ? AND p.status IN ('ACTIVE','PAUSED') ORDER BY p.created_at DESC, m.sort_order")
    .bind(access.companyId).all<Record<string, unknown>>();
  const programs = new Map<string, Record<string, unknown> & { missions: Record<string, unknown>[] }>();
  for (const row of rows.results) {
    const id = String(row.id);
    if (!programs.has(id)) programs.set(id, { id, name: row.name, slug: row.slug, status: row.status, currency: row.currency, updatedAt: row.updatedAt, missions: [] });
    if (row.missionId) programs.get(id)!.missions.push({ id: row.missionId, title: row.missionTitle, type: row.missionType, status: row.missionStatus });
  }
  return apiJson(Array.from(programs.values()));
}
