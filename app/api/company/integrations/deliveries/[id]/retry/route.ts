import { retryDelivery } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "../../../_auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const { id } = await params;
    await retryDelivery(context.company.id, id);
    return Response.json({ ok: true });
  } catch (error) { return integrationError(error); }
}
