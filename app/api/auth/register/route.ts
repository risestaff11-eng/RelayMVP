import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userRoles, users } from "../../../../db/schema";
import { hashPassword } from "../../../../lib/account-auth";
import { cleanString, sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const email = cleanString(payload.email, 180).toLowerCase();
    const displayName = cleanString(payload.name, 100);
    const phone = cleanString(payload.phone, 40);
    const companyName = cleanString(payload.company, 120);
    const password = String(payload.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Укажите корректный email");
    if (displayName.length < 2) throw new Error("Укажите имя");
    if (phone.length < 6) throw new Error("Укажите телефон");
    if (password.length < 8 || password.length > 128) throw new Error("Пароль должен содержать от 8 до 128 символов");
    if (payload.acceptedTerms !== true || payload.acceptedPrivacy !== true) throw new Error("Необходимо принять условия и согласие на обработку данных");

    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = existing[0];
    if (user) {
      const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
      if (roles.some((role) => role.role === "COMPANY")) throw new Error("Аккаунт с этим email уже существует");
    }
    const userId = user?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    if (user) {
      await db.batch([
        db.update(users).set({ displayName, phone, companyName, passwordHash, status: "pending", updatedAt: now }).where(eq(users.id, userId)),
        db.insert(userRoles).values({ userId, role: "COMPANY", createdAt: now }).onConflictDoNothing(),
      ]);
    } else {
      await db.batch([
        db.insert(users).values({ id: userId, email, displayName, phone, companyName, passwordHash, status: "pending", createdAt: now, updatedAt: now }),
        db.insert(userRoles).values({ userId, role: "COMPANY", createdAt: now }),
      ]);
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать аккаунт" }, { status: 400 });
  }
}
