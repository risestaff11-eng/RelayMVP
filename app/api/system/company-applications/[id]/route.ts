import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { companyApplications } from "../../../../../db/schema";
import { hasAdminSession } from "../../../../../lib/account-auth";
import { cleanString, sameOrigin } from "../../../company/_utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = cleanString(body?.status, 30).toUpperCase();
  if (!new Set(["NEW", "REVIEWED", "ACCEPTED", "REJECTED"]).has(status)) return Response.json({ error: "Некорректный статус" }, { status: 400 });
  const { id } = await params;
  const updated = await getDb().update(companyApplications).set({ status, updatedAt: new Date().toISOString() }).where(eq(companyApplications.id, id)).returning({ id: companyApplications.id });
  if (!updated.length) return Response.json({ error: "Заявка не найдена" }, { status: 404 });
  return Response.json({ ok: true, status });
}
