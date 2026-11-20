import type { Metadata, Viewport } from "next";
import { Caveat, DM_Sans } from "next/font/google";
import "./globals.css";

const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "600", "700"], display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Made by Myra — Custom Apparel, Gifts & Accessories", template: "%s · Made by Myra" },
  description: "Custom apparel, thoughtful gifts, and personalized creations made with love. Upload your own design or tell us your idea.",
  openGraph: { siteName: "Made by Myra", type: "website", images: ["/brand/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${caveat.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-white">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-soft">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
