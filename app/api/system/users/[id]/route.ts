import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import { deleteCompanyUser } from "../../../../../db/admin";
import { hasAdminSession } from "../../../../../lib/account-auth";
import { sameOrigin } from "../../../company/_utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  const { status } = await request.json() as { status?: string };
  if (!status || !["pending", "active", "blocked"].includes(status)) return Response.json({ error: "Некорректный статус" }, { status: 400 });
  await getDb().update(users).set({ status, updatedAt: new Date().toISOString() }).where(eq(users.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  await deleteCompanyUser(id);
  return Response.json({ ok: true });
}
