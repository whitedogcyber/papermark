import { Metadata } from "next";

import {
  BRAND_IMAGE_URL,
  BRAND_NAME,
  BRAND_URL,
  IS_CUSTOM_BRAND,
} from "@/lib/branding";

import { GTMComponent } from "@/components/gtm-component";

import LoginClient from "./page-client";

const data = {
  description: `Login to ${BRAND_NAME}`,
  title: `Login | ${BRAND_NAME}`,
  url: "/login",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    BRAND_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  ),
  title: data.title,
  description: data.description,
  openGraph: {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: BRAND_NAME,
    images: [
      {
        url: BRAND_IMAGE_URL || "/_static/brand/og-image.png",
        width: IS_CUSTOM_BRAND ? 1200 : 800,
        height: IS_CUSTOM_BRAND ? 630 : 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: data.title,
    description: data.description,
    images: [BRAND_IMAGE_URL || "/_static/brand/og-image.png"],
  },
};

export default function LoginPage() {
  return (
    <>
      <GTMComponent />
      <LoginClient />
    </>
  );
}
