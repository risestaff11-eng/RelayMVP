import { hasAdminSession } from "@/lib/account-auth";
import { updateRiseStaffBrand } from "@/lib/risestaff-brand-maintenance";
import { sameOrigin } from "../../company/_utils";

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await hasAdminSession())) return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    return Response.json(await updateRiseStaffBrand());
  } catch {
    return Response.json({ error: "Не удалось обновить название. Повторите попытку." }, { status: 500 });
  }
}
