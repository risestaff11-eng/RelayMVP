import { getChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { crmBoard } from "../../../../db/crm-board";
import { getSubmissionsForCompany } from "../../../../db/programs";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Сначала войдите" }, { status: 401 });
  const company = await getCompanyForUser(user.userId);
  if (!company) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  if (params.has("id")) {
    const item = (await getSubmissionsForCompany(company.id, { ids: [params.get("id")!] }))[0];
    return item ? Response.json({ item }) : Response.json({ error: "Клиент не найден" }, { status: 404 });
  }
  return Response.json(await crmBoard(company, Object.fromEntries(params)), { headers: { "Cache-Control": "no-store" } });
}
