import type { Metadata } from "next";
import { hasAdminSession } from "../../../lib/account-auth";
import { listAgentApplications, listCompanyApplications, listCompanyUsers, listDeletedCompanyAccounts } from "../../../db/admin";
import { SystemUsers } from "./system-users";

export const metadata: Metadata = { title: "RiseStaff system users", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SystemUsersPage() {
  const authorized = await hasAdminSession();
  const [rows, deletedRows, applications, companyApplications] = authorized ? await Promise.all([listCompanyUsers(), listDeletedCompanyAccounts(), listAgentApplications(), listCompanyApplications()]) : [[], [], [], []];
  return <SystemUsers authorized={authorized} initialRows={rows} initialDeletedRows={deletedRows} initialApplications={applications} initialCompanyApplications={companyApplications} generatedAt={new Date().toISOString()} />;
}
