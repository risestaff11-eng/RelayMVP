// Public rebrand only: stored slugs and program/mission IDs remain unchanged.
export const RISESTAFF_PROGRAM_SLUG = "risestaff-13c34fa";
const legacySlug = "relay-kz-13c34fa";

export function publicProgramSlug(slug: string) {
  return slug === legacySlug ? RISESTAFF_PROGRAM_SLUG : slug;
}

export function storedProgramSlug(slug: string) {
  return slug === RISESTAFF_PROGRAM_SLUG ? legacySlug : slug;
}

export function brandedProgramPath(path: string) {
  return path.replace(/^\/p\/([^/?#]+)(?=[/?#]|$)/, (_, slug: string) => `/p/${publicProgramSlug(slug)}`);
}
