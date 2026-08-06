import { createAdminSession, verifyAdminPassword } from "../../../../lib/account-auth";
import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const { password } = await request.json() as { password?: string };
  if (!(await verifyAdminPassword(String(password ?? "")))) return Response.json({ error: "Неверный пароль" }, { status: 401 });
  await createAdminSession();
  return Response.json({ ok: true });
}
