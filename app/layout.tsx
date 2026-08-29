import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageSwitcher } from "./language-switcher";
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
import "./company-premium.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Создавайте задания для внешних агентов, получайте новых клиентов по одной ссылке и отслеживайте каждый результат до выплаты.";

export const metadata: Metadata = {
  metadataBase: new URL("https://risestaff.kz"),
  applicationName: "Relay",
  title: {
    default: "Relay — продажи через агентов и амбассадоров",
    template: "%s · Relay",
  },
  description,
  keywords: ["канал амбассадоров", "программа для амбассадоров", "управление рекомендациями", "партнёрские продажи", "внешние продажи", "Relay", "RiseStaff"],
  creator: "Relay",
  publisher: "Relay",
  category: "business",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: "/icon-192.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Relay" },
  openGraph: {
    siteName: "Relay",
    locale: "ru_KZ",
    title: "Relay — продажи через агентов и амбассадоров",
    description,
    type: "website",
    url: "https://risestaff.kz/",
    images: [{ url: "https://risestaff.kz/og.png", width: 1731, height: 909, alt: "Relay — продажи через агентов и амбассадоров" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay — продажи через агентов и амбассадоров",
    description,
    images: ["https://risestaff.kz/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await cookies()).get("relay_locale")?.value === "kk" ? "kk" : "ru";
  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <LanguageSwitcher locale={locale} />
      </body>
    </html>
  );
}
