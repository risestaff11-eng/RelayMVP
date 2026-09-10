import { clearAdminSession, createAdminSession, verifyAdminPassword } from "../../../../lib/account-auth";
import { limitAuthentication, requestLimitResponse } from "../../../../lib/request-rate-limit";
import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  try {
    await limitAuthentication(request, "admin-login", "system-admin");
    const { password } = await request.json() as { password?: string };
    if (!(await verifyAdminPassword(String(password ?? "")))) return Response.json({ error: "Неверный пароль" }, { status: 401 });
    await createAdminSession();
    return Response.json({ ok: true });
  } catch (error) {
    const limited = requestLimitResponse(error);
    if (limited) return limited;
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось войти" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  await clearAdminSession();
  return Response.json({ ok: true });
}
