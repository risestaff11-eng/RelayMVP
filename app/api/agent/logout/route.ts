import { clearAgentSession } from "../../../../lib/agent-auth";
import { agentUrl } from "../../../../lib/public-origins";

export async function GET() {
  await clearAgentSession();
  return Response.redirect(agentUrl("/agent-login"), 303);
}
