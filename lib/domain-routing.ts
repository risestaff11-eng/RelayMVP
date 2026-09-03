import { AGENT_ORIGIN, COMPANY_ORIGIN, MARKETING_ORIGIN } from "./public-origins";

const productionHosts = new Set([
  "risestaff.kz",
  "www.risestaff.kz",
  "company.risestaff.kz",
  "agents.risestaff.kz",
]);

function isProductionSiteHost(hostname: string) {
  return productionHosts.has(hostname) || hostname.endsWith(".chatgpt.site");
}

export const COMPANY_ROUTE_ROOTS = ["dashboard", "onboarding", "auth", "admin", "system"] as const;
// IMPORTANT: adding a public agent page requires updating AGENT_ROUTE_ROOTS
// manually. The route inventory test fails for unclassified top-level pages.
export const AGENT_ROUTE_ROOTS = ["agent", "agent-login", "p", "partner", "ref"] as const;
export const MARKETING_ROUTE_ROOTS = ["integrators", "legal", "pricing"] as const;

function isCompanyPath(pathname: string) {
  return COMPANY_ROUTE_ROOTS.map((root) => `/${root}`).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAgentPath(pathname: string) {
  return AGENT_ROUTE_ROOTS.some((root) => pathname === `/${root}` || pathname.startsWith(`/${root}/`));
}

function redirectUrl(url: URL, origin: string, pathname = url.pathname) {
  const target = new URL(`${pathname}${url.search}`, origin);
  return target.href === url.href ? null : target;
}

export function canonicalRedirectFor(requestUrl: string) {
  const url = new URL(requestUrl);
  if (!isProductionSiteHost(url.hostname)) return null;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_")) return null;

  if (url.pathname === "/" && url.hostname === "company.risestaff.kz") {
    return redirectUrl(url, COMPANY_ORIGIN, "/dashboard");
  }
  if (url.pathname === "/" && url.hostname === "agents.risestaff.kz") {
    return redirectUrl(url, MARKETING_ORIGIN);
  }
  if (isCompanyPath(url.pathname)) return redirectUrl(url, COMPANY_ORIGIN);
  if (isAgentPath(url.pathname)) return redirectUrl(url, AGENT_ORIGIN);
  return redirectUrl(url, MARKETING_ORIGIN);
}
