import { clearAgentSession } from "../../../../lib/agent-auth";
import { getAgentSession } from "@/lib/agent-auth";
import { getD1 } from "@/db";
import { agentUrl } from "../../../../lib/public-origins";

export async function GET() {
  const session=await getAgentSession();
  try { if(session) await getD1().prepare("DELETE FROM agent_drafts WHERE partner_id IN (SELECT id FROM partners WHERE email = ?)").bind(session.email).run(); }
  catch { console.error("[agent-logout] Draft cleanup deferred to expiry"); }
  await clearAgentSession();
  return Response.redirect(agentUrl("/agent-login"), 303);
}
