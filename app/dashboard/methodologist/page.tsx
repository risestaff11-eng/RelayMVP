import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getCompanyKnowledge } from "../../../db/knowledge";
import { MethodologistEditor } from "./methodologist-editor";

export const metadata: Metadata = { title: "AI-Методолог" };
export const dynamic = "force-dynamic";

export default async function MethodologistPage() {
  const user = await requireChatGPTUser("/dashboard/methodologist");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const items = await getCompanyKnowledge(company.id);
  return <MethodologistEditor initialItems={items} tokenBalance={company.aiTokenBalance} />;
}
