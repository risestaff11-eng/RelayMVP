import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { PlanSettings } from "./plan-settings";

export const metadata: Metadata = { title: "Настройки профиля" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireChatGPTUser("/dashboard/settings");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  return <PlanSettings user={{ name: user.displayName, email: user.email }} company={{ name: company.name, website: company.website, contactWhatsapp: company.contactWhatsapp || user.phone, contactInstagram: company.contactInstagram, planCode: company.planCode, aiTokenBalance: company.aiTokenBalance, aiTokensUsed: company.aiTokensUsed }} />;
}
