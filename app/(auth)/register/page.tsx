import { Metadata } from "next";

import {
  BRAND_IMAGE_URL,
  BRAND_NAME,
  BRAND_URL,
  IS_CUSTOM_BRAND,
} from "@/lib/branding";

import RegisterClient from "./page-client";

const data = {
  description: `Sign up to ${BRAND_NAME}`,
  title: `Sign up | ${BRAND_NAME}`,
  url: "/register",
};

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_URL || "https://www.papermark.com"),
  title: data.title,
  description: data.description,
  openGraph: {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: BRAND_NAME,
    images: [
      {
        url: BRAND_IMAGE_URL || "/_static/meta-image.png",
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
    ...(IS_CUSTOM_BRAND ? {} : { creator: "@papermarkio" }),
    images: [BRAND_IMAGE_URL || "/_static/meta-image.png"],
  },
};

export default function RegisterPage() {
  return <RegisterClient />;
}
