export const PROGRAM_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export function isProgramStatus(value: string): value is ProgramStatus {
  return PROGRAM_STATUSES.includes(value as ProgramStatus);
}

export function acceptsNewSubmissions(value: string) {
  return value === "ACTIVE";
}

export function isVisibleInProgramApi(value: string) {
  return value === "ACTIVE" || value === "PAUSED";
}
