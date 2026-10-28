import { connectAmo } from "@/lib/integrations/amocrm";
import { inspectAmo } from "@/lib/integrations/amocrm-client";
import { integrationCompany, integrationError } from "../_auth";

export async function POST(request: Request) {
  const context = await integrationCompany(request);
  if (context.error) return context.error;
  try {
    const input = await request.json() as Record<string, unknown>;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Тело запроса должно быть JSON");
    if (input.action === "inspect") return Response.json(await inspectAmo({ url: input.url, token: input.token }), { headers: { "Cache-Control": "no-store" } });
    return Response.json({ ok: true, connection: await connectAmo(context.company.id, input) }, { status: 201 });
  } catch (error) { return integrationError(error); }
}
