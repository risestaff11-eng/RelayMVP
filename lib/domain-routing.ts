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

function isCompanyPath(pathname: string) {
  return ["/dashboard", "/onboarding", "/auth", "/admin", "/system"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAgentPath(pathname: string) {
  return pathname === "/agent" || pathname === "/agent-login" || pathname.startsWith("/agent/") || pathname.startsWith("/p/") || pathname.startsWith("/partner/") || pathname.startsWith("/ref/");
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
