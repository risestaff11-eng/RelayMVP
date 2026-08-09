import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { getConfirmedCompanyProfile, getLatestCompanyProfile } from "../../../../db/profile";
import { NewProgramForm } from "./new-program-form";

export const metadata: Metadata = { title: "Новая программа" };
export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const user = await requireChatGPTUser("/dashboard/programs/new");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const profile = await getConfirmedCompanyProfile(company.id) ?? await getLatestCompanyProfile(company.id);
  return <NewProgramForm companyName={company.name} tokenBalance={company.aiTokenBalance} profileVersion={profile?.versionNumber ?? null} profileStatus={profile?.status ?? "MISSING"} />;
}
