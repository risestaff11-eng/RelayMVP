import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/icon-192.png", "/icon-512.png", "/favicon.svg", "/og.png"], disallow: ["/api/"] },
    sitemap: "https://risestaff.kz/sitemap.xml",
  };
}
