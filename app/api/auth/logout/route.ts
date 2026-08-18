import { clearAuthSession } from "../../../../lib/account-auth";
import { marketingUrl } from "../../../../lib/public-origins";

function destination(request: Request) {
  const value = new URL(request.url).searchParams.get("returnTo") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  await clearAuthSession();
  const returnTo = destination(request);
  return Response.redirect(returnTo === "/" ? marketingUrl() : new URL(returnTo, request.url), 303);
}
