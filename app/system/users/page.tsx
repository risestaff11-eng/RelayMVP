import type { Metadata } from "next";
import { hasAdminSession } from "../../../lib/account-auth";
import { listCompanyUsers } from "../../../db/admin";
import { SystemUsers } from "./system-users";

export const metadata: Metadata = { title: "Relay system users", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SystemUsersPage() {
  const authorized = await hasAdminSession();
  const rows = authorized ? await listCompanyUsers() : [];
  return <SystemUsers authorized={authorized} initialRows={rows} />;
}
