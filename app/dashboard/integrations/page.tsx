import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCompanyForUser } from "../../../db/company";
import { getIntegrationOverview } from "../../../lib/integrations/service";
import { IntegrationManager } from "./integration-manager";
import { subscriptionAllows } from "@/lib/subscription-plans";
import { PlanRequired } from "../_components/plan-required";

export const metadata: Metadata = { title: "Интеграции" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireChatGPTUser("/dashboard/integrations");
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  if (!subscriptionAllows(company, "INTEGRATIONS")) return <PlanRequired />;
  return <IntegrationManager initial={await getIntegrationOverview(company.id)} />;
}
