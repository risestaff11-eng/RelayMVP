export const MARKETING_ORIGIN = "https://risestaff.kz";
export const COMPANY_ORIGIN = "https://company.risestaff.kz";
export const AGENT_ORIGIN = "https://agents.risestaff.kz";

function withPath(origin: string, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export function marketingUrl(path = "/") {
  return withPath(MARKETING_ORIGIN, path);
}

export function companyUrl(path = "/dashboard") {
  return withPath(COMPANY_ORIGIN, path);
}

export function agentUrl(path: string) {
  return withPath(AGENT_ORIGIN, path);
}

