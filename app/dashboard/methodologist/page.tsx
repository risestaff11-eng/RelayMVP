import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyKnowledge, getCompanyMethodologyBrief } from "../../../db/knowledge";
import { getConfirmedCompanyProfile, getLatestCompanyProfile } from "../../../db/profile";
import { MethodologistEditor } from "./methodologist-editor";

export const metadata: Metadata = { title: "Материалы для агентов" };
export const dynamic = "force-dynamic";

export default async function MethodologistPage() {
  const user = await requireChatGPTUser("/dashboard/methodologist");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const [items, brief, confirmedProfile, latestProfile] = await Promise.all([
    getCompanyKnowledge(company.id),
    getCompanyMethodologyBrief(company.id),
    getConfirmedCompanyProfile(company.id),
    getLatestCompanyProfile(company.id),
  ]);
  return <MethodologistEditor initialItems={items} initialBrief={brief} tokenBalance={company.aiTokenBalance} profileStatus={confirmedProfile ? "CONFIRMED" : latestProfile ? "DRAFT" : "MISSING"} />;
}
