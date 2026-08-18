import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard/", "/system/"] }, sitemap: "https://risestaff.kz/sitemap.xml", host: "https://risestaff.kz" };
}
