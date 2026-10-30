import { Metadata } from "next";
import { Inter } from "next/font/google";

import PlausibleProvider from "next-plausible";

import {
  BRAND_DESCRIPTION,
  BRAND_HOST,
  BRAND_IMAGE_URL,
  BRAND_NAME,
  BRAND_TITLE,
} from "@/lib/branding";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

const data = {
  description: BRAND_DESCRIPTION,
  title: BRAND_TITLE,
  url: "/",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  ),
  title: data.title,
  description: data.description,
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: BRAND_NAME,
    images: BRAND_IMAGE_URL
      ? [{ url: BRAND_IMAGE_URL, width: 1200, height: 630 }]
      : [],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: data.title,
    description: data.description,
    images: BRAND_IMAGE_URL ? [BRAND_IMAGE_URL] : [],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider
          domain={BRAND_HOST}
          enabled={process.env.NEXT_PUBLIC_VERCEL_ENV === "production"}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
