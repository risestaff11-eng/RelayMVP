import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userRoles, users } from "../../../../db/schema";
import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const { email: rawEmail } = await request.json() as { email?: string };
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Укажите корректный email" }, { status: 400 });
  const rows = await getDb().select({ displayName: users.displayName }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .where(eq(users.email, email)).limit(1);
  return Response.json({ exists: Boolean(rows[0]), displayName: rows[0]?.displayName ?? "" });
}
