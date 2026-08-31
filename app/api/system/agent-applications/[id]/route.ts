import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { agentApplications } from "../../../../../db/schema";
import { hasAdminSession } from "../../../../../lib/account-auth";
import { cleanString, sameOrigin } from "../../../company/_utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const payload = await request.json() as Record<string, unknown>;
  const status = cleanString(payload.status, 30).toUpperCase();
  if (!new Set(["NEW", "REVIEWED", "ACCEPTED", "REJECTED"]).has(status)) return Response.json({ error: "Некорректный статус" }, { status: 400 });
  const { id } = await params;
  const now = new Date().toISOString();
  await getDb().update(agentApplications).set({ status, reviewedAt: status === "NEW" ? null : now, updatedAt: now }).where(eq(agentApplications.id, id));
  return Response.json({ ok: true, status, reviewedAt: status === "NEW" ? null : now });
}
