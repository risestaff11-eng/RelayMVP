import { getAdminSessionId } from "../../../../../../lib/account-auth";
import { changeSubscription, subscriptionHistory } from "../../../../../../lib/subscription-admin";
import { sameOrigin } from "../../../../company/_utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSessionId())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  return Response.json({ events: await subscriptionHistory((await params).id) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  const actor = await getAdminSessionId();
  if (!actor) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    return Response.json({ event: await changeSubscription((await params).id, actor, payload) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось изменить тариф" }, { status: 400 });
  }
}
