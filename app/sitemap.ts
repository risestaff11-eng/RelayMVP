import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Keep the brand migration visible to crawlers until the new RiseStaff
  // title and copy have replaced the former name in their indexes.
  const lastModified = new Date("2026-09-02T00:00:00.000Z");
  return ["", "/pricing", "/integrators", "/legal/privacy", "/legal/license"].map((path, index) => ({
    url: `https://risestaff.kz${path || "/"}`,
    lastModified,
    changeFrequency: index === 0 ? "weekly" as const : "monthly" as const,
    priority: index === 0 ? 1 : 0.6,
  }));
}
