import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import Head from "next/head";

import { TeamProvider } from "@/context/team-context";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import PlausibleProvider from "next-plausible";
import { NuqsAdapter } from "nuqs/adapters/next/pages";

import {
  BRAND_DESCRIPTION,
  BRAND_HOST,
  BRAND_IMAGE_URL,
  BRAND_NAME,
  BRAND_TITLE,
  BRAND_URL,
} from "@/lib/branding";
import { EXCLUDED_PATHS } from "@/lib/constants";

import { PostHogCustomProvider } from "@/components/providers/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function App({
  Component,
  pageProps: { session, ...pageProps },
  router,
}: AppProps<{ session: Session }>) {
  return (
    <>
      <Head>
        <title>{BRAND_TITLE}</title>
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content={BRAND_DESCRIPTION}
          key="description"
        />
        <meta property="og:title" content={BRAND_TITLE} key="og-title" />
        <meta
          property="og:description"
          content={BRAND_DESCRIPTION}
          key="og-description"
        />
        {BRAND_IMAGE_URL ? (
          <meta property="og:image" content={BRAND_IMAGE_URL} key="og-image" />
        ) : null}
        {BRAND_URL ? (
          <meta property="og:url" content={BRAND_URL} key="og-url" />
        ) : null}
        <meta property="og:site_name" content={BRAND_NAME} />
        <meta property="og:type" content="website" />
        <meta
          name="twitter:card"
          content={BRAND_IMAGE_URL ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={BRAND_NAME} key="tw-title" />
        <meta
          name="twitter:description"
          content={BRAND_DESCRIPTION}
          key="tw-description"
        />
        {BRAND_IMAGE_URL ? (
          <meta name="twitter:image" content={BRAND_IMAGE_URL} key="tw-image" />
        ) : null}
        <link rel="icon" href="/favicon.ico" key="favicon" />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
          key="apple-icon"
        />
      </Head>
      <SessionProvider session={session}>
        <PostHogCustomProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <PlausibleProvider
              domain={BRAND_HOST}
              enabled={process.env.NEXT_PUBLIC_VERCEL_ENV === "production"}
            >
              <NuqsAdapter>
                <main className={inter.className}>
                  <Toaster closeButton />
                  <TooltipProvider delayDuration={100}>
                    {EXCLUDED_PATHS.includes(router.pathname) ? (
                      <Component {...pageProps} />
                    ) : (
                      <TeamProvider>
                        <Component {...pageProps} />
                      </TeamProvider>
                    )}
                  </TooltipProvider>
                </main>
              </NuqsAdapter>
            </PlausibleProvider>
          </ThemeProvider>
        </PostHogCustomProvider>
      </SessionProvider>
    </>
  );
}
