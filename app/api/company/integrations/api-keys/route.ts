import { createApiKey } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "../_auth";

export async function POST(request: Request) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    return Response.json({ ok: true, apiKey: await createApiKey(context.company.id, await request.json()) }, { status: 201 });
  } catch (error) { return integrationError(error); }
}
