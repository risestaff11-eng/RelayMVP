import type { Metadata } from "next";
import { hasAdminSession } from "../../../lib/account-auth";
import { listCompanyUsers, listDeletedCompanyAccounts } from "../../../db/admin";
import { SystemUsers } from "./system-users";

export const metadata: Metadata = { title: "Relay system users", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SystemUsersPage() {
  const authorized = await hasAdminSession();
  const [rows, deletedRows] = authorized ? await Promise.all([listCompanyUsers(), listDeletedCompanyAccounts()]) : [[], []];
  return <SystemUsers authorized={authorized} initialRows={rows} initialDeletedRows={deletedRows} generatedAt={new Date().toISOString()} />;
}
