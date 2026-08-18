import { getDb } from "@/db";
import { marketingEvents } from "@/db/schema";

const allowedEvents = new Set(["page_view", "header_primary", "hero_primary", "hero_secondary", "whatsapp_header", "pricing_link", "offer_primary", "final_primary", "mobile_sticky"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { event?: unknown; path?: unknown };
    if (typeof body.event !== "string" || !allowedEvents.has(body.event)) return new Response(null, { status: 400 });
    const path = typeof body.path === "string" && body.path.startsWith("/") && body.path.length <= 160 ? body.path : "/";
    await getDb().insert(marketingEvents).values({ id: crypto.randomUUID(), event: body.event, path });
    return new Response(null, { status: 202 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
