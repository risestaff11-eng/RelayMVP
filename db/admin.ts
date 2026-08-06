import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from ".";
import { userRoles, users } from "./schema";

export async function listCompanyUsers() {
  return getDb().select({
    id: users.id,
    name: users.displayName,
    email: users.email,
    phone: users.phone,
    company: users.companyName,
    createdAt: users.createdAt,
    status: users.status,
  }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .orderBy(desc(users.createdAt));
}

export async function deleteCompanyUser(userId: string) {
  const database = (env as unknown as { DB: D1Database }).DB;
  const statements = [
    "DELETE FROM contact_verification_codes WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM submission_disputes WHERE submission_id IN (SELECT id FROM submissions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM submission_status_events WHERE submission_id IN (SELECT id FROM submissions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM submission_attachments WHERE submission_id IN (SELECT id FROM submissions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM rewards WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM submissions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM partner_mission_acceptances WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM partner_access_links WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM partner_profiles WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM legal_acceptances WHERE user_id = ? OR program_id IN (SELECT id FROM programs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM missions WHERE program_id IN (SELECT id FROM programs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM programs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_profile_versions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_members WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?) OR user_id = ?",
    "DELETE FROM companies WHERE owner_user_id = ?",
    "UPDATE partners SET user_id = NULL WHERE user_id = ?",
    "DELETE FROM auth_sessions WHERE user_id = ?",
    "DELETE FROM user_roles WHERE user_id = ?",
    "DELETE FROM users WHERE id = ?",
  ];
  await database.batch(statements.map((statement) => {
    const count = (statement.match(/\?/g) ?? []).length;
    return database.prepare(statement).bind(...Array.from({ length: count }, () => userId));
  }));
}
