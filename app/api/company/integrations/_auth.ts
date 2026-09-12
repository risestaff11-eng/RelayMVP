import { getCompanyForUser } from "@/db/company";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sameOrigin } from "../_utils";
import { companyPermissionDenied, hasCompanyPermission } from "@/lib/company-permissions";
import { subscriptionDenied } from "@/lib/company-subscription";

export async function integrationCompany(request: Request) {
  if (!sameOrigin(request)) return { error: Response.json({ error: "Недопустимый источник запроса" }, { status: 403 }) };
  const user = await getChatGPTUser();
  if (!user) return { error: Response.json({ error: "Сначала войдите" }, { status: 401 }) };
  const company = await getCompanyForUser(user.userId);
  if (!company) return { error: Response.json({ error: "Компания не найдена" }, { status: 404 }) };
  if (!hasCompanyPermission(company.role, "INTEGRATIONS_MANAGE")) return { error: companyPermissionDenied() };
  const denied = await subscriptionDenied(company, "INTEGRATIONS");
  if (denied && request.method !== "DELETE") return { error: denied };
  return { company };
}

export function integrationError(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить действие" }, { status: 400 });
}
