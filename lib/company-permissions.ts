export type CompanyPermission =
  | "PROGRAMS_MANAGE"
  | "CRM_MANAGE"
  | "AGENTS_MANAGE"
  | "REPORTS_MANAGE"
  | "PAYOUTS_MANAGE"
  | "INTEGRATIONS_MANAGE"
  | "COMPANY_SETTINGS_MANAGE"
  | "DATA_EXPORT";

const ROLE_PERMISSIONS: Record<string, ReadonlySet<CompanyPermission>> = {
  OWNER: new Set<CompanyPermission>(["PROGRAMS_MANAGE", "CRM_MANAGE", "AGENTS_MANAGE", "REPORTS_MANAGE", "PAYOUTS_MANAGE", "INTEGRATIONS_MANAGE", "COMPANY_SETTINGS_MANAGE", "DATA_EXPORT"]),
  MANAGER: new Set<CompanyPermission>(["PROGRAMS_MANAGE", "CRM_MANAGE", "AGENTS_MANAGE", "REPORTS_MANAGE"]),
  FINANCE: new Set<CompanyPermission>(["PAYOUTS_MANAGE", "DATA_EXPORT"]),
};

export function hasCompanyPermission(role: string, permission: CompanyPermission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function companyPermissionDenied() {
  return Response.json({ error: "У вашей роли нет права на это действие" }, { status: 403 });
}
