import { revokeApiKey } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "../../_auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const { id } = await params;
    await revokeApiKey(context.company.id, id);
    return Response.json({ ok: true });
  } catch (error) { return integrationError(error); }
}
