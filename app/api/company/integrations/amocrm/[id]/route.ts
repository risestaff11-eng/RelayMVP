import { amoConnection, syncAmo, updateAmo } from "@/lib/integrations/amocrm";
import { dispatchPendingDeliveries } from "@/lib/integrations/service";
import { integrationCompany, integrationError } from "../../_auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    await updateAmo(context.company.id, (await params).id, await request.json());
    return Response.json({ ok: true });
  } catch (error) { return integrationError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const id = (await params).id;
    await amoConnection(context.company.id, id);
    await dispatchPendingDeliveries(context.company.id);
    return Response.json(await syncAmo(context.company.id, id));
  } catch (error) { return integrationError(error); }
}
