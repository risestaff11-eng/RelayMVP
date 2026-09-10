"use client";

import { useEffect } from "react";

const allowedEvents = new Set(["page_view", "header_primary", "hero_primary", "hero_secondary", "agent_login", "whatsapp_header", "pricing_link", "offer_primary", "final_primary", "mobile_sticky", "application_header", "application_offer", "final_application", "special_offer_application"]);

export type MarketingAttribution = {
  visitId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  firstUtmSource: string;
  firstUtmMedium: string;
  firstUtmCampaign: string;
  lastUtmSource: string;
  lastUtmMedium: string;
  lastUtmCampaign: string;
};

export function readMarketingAttribution(): MarketingAttribution {
  const storageKey = "risestaff_marketing_attribution_v2";
  const current = new URLSearchParams(window.location.search);
  const fromUrl = { utmSource: current.get("utm_source") || "", utmMedium: current.get("utm_medium") || "", utmCampaign: current.get("utm_campaign") || "" };
  const hasUrlAttribution = Object.values(fromUrl).some(Boolean);
  let saved: Partial<MarketingAttribution> = {};
  try { saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}"); } catch { saved = {}; }
  const visitId = typeof saved.visitId === "string" && saved.visitId ? saved.visitId : crypto.randomUUID();
  const first = {
    utmSource: typeof saved.firstUtmSource === "string" ? saved.firstUtmSource : hasUrlAttribution ? fromUrl.utmSource : "",
    utmMedium: typeof saved.firstUtmMedium === "string" ? saved.firstUtmMedium : hasUrlAttribution ? fromUrl.utmMedium : "",
    utmCampaign: typeof saved.firstUtmCampaign === "string" ? saved.firstUtmCampaign : hasUrlAttribution ? fromUrl.utmCampaign : "",
  };
  const last = hasUrlAttribution ? fromUrl : {
    utmSource: typeof saved.lastUtmSource === "string" ? saved.lastUtmSource : first.utmSource,
    utmMedium: typeof saved.lastUtmMedium === "string" ? saved.lastUtmMedium : first.utmMedium,
    utmCampaign: typeof saved.lastUtmCampaign === "string" ? saved.lastUtmCampaign : first.utmCampaign,
  };
  const attribution = {
    visitId,
    ...first,
    firstUtmSource: first.utmSource,
    firstUtmMedium: first.utmMedium,
    firstUtmCampaign: first.utmCampaign,
    lastUtmSource: last.utmSource,
    lastUtmMedium: last.utmMedium,
    lastUtmCampaign: last.utmCampaign,
  };
  try { window.localStorage.setItem(storageKey, JSON.stringify(attribution)); } catch { /* analytics must never block the page */ }
  return attribution;
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

function attachAttributionToCompanyLink(target: Element | null) {
  const anchor = target?.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return;
  let destination: URL;
  try { destination = new URL(anchor.href, window.location.href); } catch { return; }
  const isCompanyEntry = destination.hostname === "company.risestaff.kz" && (destination.pathname === "/auth" || destination.pathname.startsWith("/dashboard"));
  if (!isCompanyEntry) return;
  const attribution = readMarketingAttribution();
  destination.searchParams.set("rs_visit", attribution.visitId);
  destination.searchParams.set("rs_first_source", attribution.firstUtmSource);
  destination.searchParams.set("rs_first_medium", attribution.firstUtmMedium);
  destination.searchParams.set("rs_first_campaign", attribution.firstUtmCampaign);
  destination.searchParams.set("rs_last_source", attribution.lastUtmSource);
  destination.searchParams.set("rs_last_medium", attribution.lastUtmMedium);
  destination.searchParams.set("rs_last_campaign", attribution.lastUtmCampaign);
  anchor.href = destination.toString();
}

export function MarketingAnalytics() {
  useEffect(() => {
    record("page_view");
    const onClick = (event: MouseEvent) => {
      attachAttributionToCompanyLink(event.target instanceof Element ? event.target : null);
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track]") : null;
      if (target?.dataset.track) record(target.dataset.track);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
