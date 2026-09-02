import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ["", "/pricing", "/integrators", "/legal/privacy", "/legal/license"].map((path, index) => ({
    url: `https://risestaff.kz${path || "/"}`,
    lastModified,
    changeFrequency: index === 0 ? "weekly" as const : "monthly" as const,
    priority: index === 0 ? 1 : 0.6,
  }));
}
