import { clearAuthSession } from "../../../../lib/account-auth";

function destination(request: Request) {
  const value = new URL(request.url).searchParams.get("returnTo") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  await clearAuthSession();
  return Response.redirect(new URL(destination(request), request.url), 303);
}
