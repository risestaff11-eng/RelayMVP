import type { Metadata } from "next";
import { marketingUrl } from "./public-origins";

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const brandedTitle = /RiseStaff/i.test(title) ? title : `${title} · RiseStaff`;
  const url = marketingUrl(path);
  return {
    title: { absolute: brandedTitle }, description,
    alternates: { canonical: url },
    openGraph: { title: brandedTitle, description, url, siteName: "RiseStaff", type: "website", locale: "ru_KZ", images: [{ url: marketingUrl("/og.jpg?v=20260902"), width: 1731, height: 909, alt: "RiseStaff" }] },
    twitter: { card: "summary_large_image", title: brandedTitle, description, images: [marketingUrl("/og.jpg?v=20260902")] },
  };
}
