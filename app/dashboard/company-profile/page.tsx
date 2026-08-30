import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getLatestCompanyProfile } from "../../../db/profile";
import { CompanyProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Профиль компании" };
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const user = await requireChatGPTUser("/dashboard/company-profile");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const profile = await getLatestCompanyProfile(company.id);

  return (
    <CompanyProfileEditor
      company={{ id: company.id, name: company.name, website: company.website, industry: company.industry, aiTokenBalance: company.aiTokenBalance }}
      initialProfile={profile}
    />
  );
}
