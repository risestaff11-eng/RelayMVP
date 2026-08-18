import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./landing-extra.css";
import "./landing-refine.css";
import "./mobile-role-ux.css";
import "./landing-mobile.css";
import "./agent-mobile-simple.css";
import "./mobile-drawer-ux.css";
import "./ui-polish.css";
import "./marketing-polish.css";
import "./agent-polish.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "Создавайте агентские программы, запускайте задания и прозрачно работайте с внешними продавцами.";

  return {
    metadataBase: new URL("https://risestaff.kz"),
    title: {
      default: "Relay — агентские продажи по одной ссылке",
      template: "%s · Relay",
    },
    description,
    alternates: { canonical: "https://risestaff.kz/" },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      shortcut: "/favicon.svg",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Relay" },
    openGraph: {
      title: "Relay — агентские продажи по одной ссылке",
      description,
      type: "website",
      url: "https://risestaff.kz/",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "Relay — агентские продажи по одной ссылке" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Relay — агентские продажи по одной ссылке",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
