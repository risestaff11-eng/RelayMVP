import { clearSupportSession } from "../../../../../lib/account-auth";
import { companyUrl } from "../../../../../lib/public-origins";

export async function GET() {
  await clearSupportSession();
  return Response.redirect(companyUrl("/system/users"), 303);
}
