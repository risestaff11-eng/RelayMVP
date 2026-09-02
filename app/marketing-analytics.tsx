"use client";

import { useEffect } from "react";

const allowedEvents = new Set(["page_view", "header_primary", "hero_primary", "hero_secondary", "whatsapp_header", "pricing_link", "offer_primary", "final_primary", "mobile_sticky", "application_header", "application_offer", "final_application", "special_offer_application"]);

export type MarketingAttribution = { utmSource: string; utmMedium: string; utmCampaign: string };

export function readMarketingAttribution(): MarketingAttribution {
  const storageKey = "risestaff_marketing_attribution";
  const current = new URLSearchParams(window.location.search);
  const fromUrl = { utmSource: current.get("utm_source") || "", utmMedium: current.get("utm_medium") || "", utmCampaign: current.get("utm_campaign") || "" };
  const hasUrlAttribution = Object.values(fromUrl).some(Boolean);
  if (hasUrlAttribution) window.localStorage.setItem(storageKey, JSON.stringify(fromUrl));
  try { return hasUrlAttribution ? fromUrl : JSON.parse(window.localStorage.getItem(storageKey) || "{}") as MarketingAttribution; } catch { return fromUrl; }
}

function record(event: string) {
  if (!allowedEvents.has(event)) return;
  const body = JSON.stringify({ event, path: window.location.pathname, ...readMarketingAttribution() });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/marketing/events", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/marketing/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
}

export function MarketingAnalytics() {
  useEffect(() => {
    record("page_view");
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track]") : null;
      if (target?.dataset.track) record(target.dataset.track);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
