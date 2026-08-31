import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAgentSession } from "../../lib/agent-auth";
import { AgentAccessFlow } from "./agent-access-flow";

export const metadata: Metadata = { title: "Вход для агента · Yaler", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AgentLoginPage() {
  if (await getAgentSession()) redirect("/agent");
  return <AgentAccessFlow />;
}

