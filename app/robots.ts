import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/integrators", "/legal/", "/p/", "/icon-192.png", "/icon-512.png", "/favicon.svg", "/og.jpg"],
      disallow: ["/api/", "/auth", "/onboarding", "/dashboard/", "/system/", "/agent", "/agent-login", "/partner/", "/ref/"],
    },
    sitemap: "https://risestaff.kz/sitemap.xml",
    host: "https://risestaff.kz",
  };
}
