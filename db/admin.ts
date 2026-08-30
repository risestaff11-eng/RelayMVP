import { env } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from ".";
import { companies, companyAccountDeletionLogs, userRoles, users } from "./schema";

export type CompanyAdminRow = {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  status: string;
  emailVerifiedAt: string | null;
  tokenBalance: number | null;
  tokensUsed: number | null;
  programCount: number;
  activeProgramCount: number;
  agentCount: number;
  activeAgentCount: number;
  submissionCount: number;
  pendingSubmissionCount: number;
  paidRewardsCount: number;
  paidRewardsAmount: number;
  dueRewardsAmount: number;
  lastAgentActivityAt: string | null;
  lastSubmissionAt: string | null;
};

export type DeletedCompanyAdminRow = {
  id: string;
  originalUserId: string;
  originalCompanyId: string | null;
  companyName: string;
  emailMasked: string;
  emailDomain: string;
  programsCount: number;
  agentsCount: number;
  submissionsCount: number;
  paidRewardsCount: number;
  paidRewardsAmount: number;
  storageCleanupStatus: string;
  deletedAt: string;
};

export async function listCompanyUsers(): Promise<CompanyAdminRow[]> {
  return getDb().select({
    id: users.id,
    companyId: companies.id,
    name: users.displayName,
    email: users.email,
    phone: users.phone,
    company: users.companyName,
    website: companies.website,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastLoginAt: users.lastLoginAt,
    loginCount: users.loginCount,
    status: users.status,
    emailVerifiedAt: users.emailVerifiedAt,
    tokenBalance: companies.aiTokenBalance,
    tokensUsed: companies.aiTokensUsed,
    programCount: sql<number>`coalesce((select count(*) from programs p where p.company_id = ${companies.id}), 0)`,
    activeProgramCount: sql<number>`coalesce((select count(*) from programs p where p.company_id = ${companies.id} and p.status = 'ACTIVE'), 0)`,
    agentCount: sql<number>`coalesce((select count(distinct lower(p.email)) from partners p where p.company_id = ${companies.id}), 0)`,
    activeAgentCount: sql<number>`coalesce((select count(distinct lower(p.email)) from partners p where p.company_id = ${companies.id} and p.status = 'ACTIVE'), 0)`,
    submissionCount: sql<number>`coalesce((select count(*) from submissions s where s.company_id = ${companies.id}), 0)`,
    pendingSubmissionCount: sql<number>`coalesce((select count(*) from submissions s where s.company_id = ${companies.id} and s.status in ('SUBMITTED', 'REVIEWING')), 0)`,
    paidRewardsCount: sql<number>`coalesce((select count(*) from rewards r where r.company_id = ${companies.id} and r.status = 'PAID'), 0)`,
    paidRewardsAmount: sql<number>`coalesce((select sum(r.amount) from rewards r where r.company_id = ${companies.id} and r.status = 'PAID'), 0)`,
    dueRewardsAmount: sql<number>`coalesce((select sum(r.amount) from rewards r where r.company_id = ${companies.id} and r.status = 'APPROVED'), 0)`,
    lastAgentActivityAt: sql<string | null>`(select max(coalesce(p.last_active_at, p.joined_at)) from partners p where p.company_id = ${companies.id})`,
    lastSubmissionAt: sql<string | null>`(select max(s.created_at) from submissions s where s.company_id = ${companies.id})`,
  }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "COMPANY")))
    .leftJoin(companies, eq(companies.ownerUserId, users.id))
    .orderBy(desc(users.createdAt));
}

export async function listDeletedCompanyAccounts(): Promise<DeletedCompanyAdminRow[]> {
  return getDb().select().from(companyAccountDeletionLogs).orderBy(desc(companyAccountDeletionLogs.deletedAt));
}

function maskedEmail(email: string) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible || "*"}${local.length > visible.length ? "***" : ""}@${domain}`;
}

async function deleteCompanyObjects(companyId: string) {
  const bucket = (env as unknown as { FILES?: R2Bucket }).FILES;
  if (!bucket) throw new Error("R2 binding FILES is unavailable");
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${companyId}/`, cursor, limit: 1000 });
    if (page.objects.length) await bucket.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function deleteCompanyUser(userId: string) {
  const source = (await listCompanyUsers()).find((row) => row.id === userId);
  if (!source) return null;

  const database = (env as unknown as { DB: D1Database }).DB;
  const deletedAt = new Date().toISOString();
  const deletionId = crypto.randomUUID();
  const emailDomain = source.email.split("@")[1]?.toLowerCase() ?? "";
  const statements: D1PreparedStatement[] = [
    database.prepare("INSERT INTO company_account_deletion_logs (id, original_user_id, original_company_id, company_name, email_masked, email_domain, programs_count, agents_count, submissions_count, paid_rewards_count, paid_rewards_amount, storage_cleanup_status, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)")
      .bind(deletionId, userId, source.companyId, source.company || source.name, maskedEmail(source.email), emailDomain, source.programCount, source.agentCount, source.submissionCount, source.paidRewardsCount, source.paidRewardsAmount, deletedAt),
  ];
  const deletionSql = [
    "DELETE FROM company_email_verification_codes WHERE user_id = ?",
    "DELETE FROM contact_verification_codes WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM partner_referral_links WHERE partner_id IN (SELECT id FROM partners WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
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
    "DELETE FROM mission_resources WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM missions WHERE program_id IN (SELECT id FROM programs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?))",
    "DELETE FROM programs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_knowledge_items WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_methodology_briefs WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_profile_versions WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?)",
    "DELETE FROM company_members WHERE company_id IN (SELECT id FROM companies WHERE owner_user_id = ?) OR user_id = ?",
    "DELETE FROM companies WHERE owner_user_id = ?",
    "UPDATE partners SET user_id = NULL WHERE user_id = ?",
    "DELETE FROM auth_sessions WHERE user_id = ?",
    "DELETE FROM user_roles WHERE user_id = ?",
    "DELETE FROM users WHERE id = ?",
  ];
  statements.push(...deletionSql.map((statement) => {
    const count = (statement.match(/\?/g) ?? []).length;
    return database.prepare(statement).bind(...Array.from({ length: count }, () => userId));
  }));
  await database.batch(statements);

  const remaining = await database.prepare("SELECT count(*) AS value FROM users WHERE id = ?").bind(userId).first<{ value: number }>();
  if (Number(remaining?.value ?? 0) !== 0) throw new Error("Аккаунт не был удалён полностью");

  let storageCleanupStatus = "COMPLETE";
  if (source.companyId) {
    try {
      await deleteCompanyObjects(source.companyId);
    } catch (error) {
      storageCleanupStatus = "FAILED";
      console.error("Company R2 cleanup failed", error);
    }
  }
  await database.prepare("UPDATE company_account_deletion_logs SET storage_cleanup_status = ? WHERE id = ?")
    .bind(storageCleanupStatus, deletionId).run();

  return {
    id: deletionId,
    originalUserId: userId,
    originalCompanyId: source.companyId,
    companyName: source.company || source.name,
    emailMasked: maskedEmail(source.email),
    emailDomain,
    programsCount: source.programCount,
    agentsCount: source.agentCount,
    submissionsCount: source.submissionCount,
    paidRewardsCount: source.paidRewardsCount,
    paidRewardsAmount: source.paidRewardsAmount,
    storageCleanupStatus,
    deletedAt,
  } satisfies DeletedCompanyAdminRow;
}
