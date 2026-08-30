import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { AiAssistantChat } from "./ai-assistant-chat";

export const metadata: Metadata = { title: "Yaler · помощник по программам" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireChatGPTUser("/dashboard/assistant");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  return <AiAssistantChat companyName={company.name} initialTokenBalance={company.aiTokenBalance} />;
}
