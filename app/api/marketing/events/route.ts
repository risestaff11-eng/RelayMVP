import { getDb } from "@/db";
import { marketingEvents } from "@/db/schema";
import { limitMarketingEvents, requestLimitResponse } from "@/lib/request-rate-limit";

const allowedEvents = new Set(["page_view", "header_primary", "hero_primary", "hero_secondary", "agent_login", "whatsapp_header", "pricing_link", "offer_primary", "final_primary", "mobile_sticky", "application_header", "application_offer", "final_application", "special_offer_application"]);

function utm(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 120) : ""; }

export async function POST(request: Request) {
  try {
    await limitMarketingEvents(request);
    const body = await request.json() as { event?: unknown; path?: unknown; visitId?: unknown; utmSource?: unknown; utmMedium?: unknown; utmCampaign?: unknown; lastUtmSource?: unknown; lastUtmMedium?: unknown; lastUtmCampaign?: unknown };
    if (typeof body.event !== "string" || !allowedEvents.has(body.event)) return new Response(null, { status: 400 });
    const path = typeof body.path === "string" && body.path.startsWith("/") && body.path.length <= 160 ? body.path : "/";
    await getDb().insert(marketingEvents).values({ id: crypto.randomUUID(), event: body.event, path, visitId: utm(body.visitId), utmSource: utm(body.utmSource), utmMedium: utm(body.utmMedium), utmCampaign: utm(body.utmCampaign), lastUtmSource: utm(body.lastUtmSource), lastUtmMedium: utm(body.lastUtmMedium), lastUtmCampaign: utm(body.lastUtmCampaign) });
    return new Response(null, { status: 202 });
  } catch (error) {
    const limited = requestLimitResponse(error);
    if (limited) return limited;
    return new Response(null, { status: 400 });
  }
}
