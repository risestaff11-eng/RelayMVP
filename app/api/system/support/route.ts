import { createSupportSession, hasAdminSession } from "../../../../lib/account-auth";
import { cleanString, sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const companyId = cleanString(payload.companyId, 80);
    if (!companyId) throw new Error("Компания не выбрана");
    await createSupportSession(companyId, cleanString(payload.reason, 240) || "Оперативная техподдержка");
    return Response.json({ ok: true, redirect: "/dashboard" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось открыть кабинет" }, { status: 400 });
  }
}

