/** Only allow company-local destinations; never redirect back into authentication. */
function unsafeCharacters(value: string) {
  return [...value].some((character) => character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

export function companyReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || unsafeCharacters(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://company.risestaff.kz");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://company.risestaff.kz" || unsafeCharacters(path) || path.startsWith("//")) return "/dashboard";
    if (!/^\/(dashboard|onboarding|admin)(\/|$)/.test(path)) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
