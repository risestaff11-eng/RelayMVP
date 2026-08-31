import { createCompanyAccessForAgent } from "../../../../db/agent-access";
import { getAgentSession } from "../../../../lib/agent-auth";
import { agentUrl } from "../../../../lib/public-origins";

export async function GET(request: Request) {
  const session = await getAgentSession();
  if (!session) return Response.redirect(agentUrl("/agent-login"), 303);
  const companyId = new URL(request.url).searchParams.get("companyId") ?? "";
  const token = await createCompanyAccessForAgent(session.email, session.phone, companyId);
  if (!token) return Response.redirect(agentUrl("/agent?error=company"), 303);
  return Response.redirect(agentUrl(`/partner/${token}`), 303);
}

