import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Vite replaces this with the build timestamp, not the crawler's request time.
  const lastModified = process.env.SITE_BUILD_DATE;
  return ["", "/pricing", "/integrators", "/legal/privacy", "/legal/license"].map((path, index) => ({
    url: `https://risestaff.kz${path || "/"}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: index === 0 ? "weekly" as const : "monthly" as const,
    priority: index === 0 ? 1 : 0.6,
  }));
}
