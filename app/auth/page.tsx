import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountUser } from "../../lib/account-auth";
import { companyReturnTo } from "../../lib/auth-navigation";
import { AuthFlow } from "./auth-flow";

export const metadata: Metadata = { title: "Вход в RiseStaff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = "/dashboard" } = await searchParams;
  const safeReturnTo = companyReturnTo(returnTo);
  if (await getAccountUser()) redirect(safeReturnTo);
  return <AuthFlow returnTo={safeReturnTo} />;
}
