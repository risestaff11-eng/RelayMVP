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
import "./readability.css";
import "./mobile-overhaul.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Ваши клиенты и партнёры рекомендуют вас покупателям. Вы видите, кто привёл каждого клиента, что стало с заявкой и сколько нужно выплатить.";

export const metadata: Metadata = {
  metadataBase: new URL("https://risestaff.kz"),
  applicationName: "RiseStaff",
  title: {
    default: "RiseStaff — новые клиенты через рекомендации",
    template: "%s · RiseStaff",
  },
  description,
  keywords: ["приведи клиента", "вознаграждение за клиента", "программа рекомендаций", "партнёрские продажи", "учёт выплат", "RiseStaff"],
  creator: "RiseStaff",
  publisher: "RiseStaff",
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
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RiseStaff" },
  openGraph: {
    siteName: "RiseStaff",
    locale: "ru_KZ",
    title: "RiseStaff — новые клиенты через рекомендации",
    description,
    type: "website",
    url: "https://risestaff.kz/",
    images: [{ url: "https://risestaff.kz/og.jpg?v=20260902", width: 1731, height: 909, alt: "RiseStaff — новые клиенты через рекомендации" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RiseStaff — новые клиенты через рекомендации",
    description,
    images: ["https://risestaff.kz/og.jpg?v=20260902"],
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
        <LanguageSwitcher locale={locale} className="global-language-switcher" />
      </body>
    </html>
  );
}
