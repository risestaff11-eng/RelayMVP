import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountUser } from "../../lib/account-auth";
import { AuthFlow } from "./auth-flow";

export const metadata: Metadata = { title: "Вход в Yaler", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = "/dashboard" } = await searchParams;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  if (await getAccountUser()) redirect(safeReturnTo);
  return <AuthFlow returnTo={safeReturnTo} />;
}
