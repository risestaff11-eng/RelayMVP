import { updateWebhookConnection } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "../_auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const { id } = await params;
    return Response.json({ ok: true, connection: await updateWebhookConnection(context.company.id, id, await request.json()) });
  } catch (error) { return integrationError(error); }
}
