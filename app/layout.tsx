import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "./landing-extra.css";
import "./landing-refine.css";
import "./mobile-role-ux.css";
import "./landing-mobile.css";

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
  const description = "Создавайте партнёрские программы, запускайте миссии и прозрачно работайте с внешними продавцами.";

  return {
    title: {
      default: "Relay — партнёрские продажи по одной ссылке",
      template: "%s · Relay",
    },
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Relay — партнёрские продажи по одной ссылке",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "Relay — партнёрские продажи по одной ссылке" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Relay — партнёрские продажи по одной ссылке",
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
