import { createWebhookConnection } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "./_auth";

export async function POST(request: Request) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const connection = await createWebhookConnection(context.company.id, await request.json());
    return Response.json({ ok: true, connection }, { status: 201 });
  } catch (error) { return integrationError(error); }
}
