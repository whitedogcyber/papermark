/**
 * Public-facing branding: page titles, link previews and logos.
 * Brand NEXT_PUBLIC_* values are compiled in at build time. The app URL and
 * host are build placeholders swapped for the runtime values when the
 * container starts (docker-entrypoint.sh), so one image serves every
 * environment. Support, help, terms and privacy links are runtime settings:
 * see lib/runtime-links.ts.
 */
const env = (v: string | undefined) => v?.trim() || "";

export const BRAND_NAME =
  env(process.env.NEXT_PUBLIC_BRAND_NAME) || "WhiteDog Share";

/** Always true in this fork; kept so existing checks still compile. */
export const IS_CUSTOM_BRAND = true;

export const BRAND_COMPANY =
  env(process.env.NEXT_PUBLIC_BRAND_COMPANY) || "WhiteDog Cyber";

export const BRAND_TITLE =
  env(process.env.NEXT_PUBLIC_BRAND_TITLE) || BRAND_NAME;

export const BRAND_DESCRIPTION =
  env(process.env.NEXT_PUBLIC_BRAND_DESCRIPTION) ||
  `Secure document sharing by ${BRAND_COMPANY}.`;

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const absolute = (u: string) => (u.startsWith("/") ? `${baseUrl}${u}` : u);

/** Host shown for links without a custom domain, e.g. share.whitedog.cloud. */
export const BRAND_HOST =
  env(process.env.NEXT_PUBLIC_APP_BASE_HOST) ||
  baseUrl.replace(/^https?:\/\//, "") ||
  "localhost";

/** Absolute URL of the preview image; empty means no image. */
export const BRAND_IMAGE_URL = absolute(
  process.env.NEXT_PUBLIC_BRAND_IMAGE_URL?.trim() ??
    "/_static/brand/og-image.png",
);

/** Logo for light backgrounds (sign-in, registration). */
export const BRAND_LOGO_URL =
  env(process.env.NEXT_PUBLIC_BRAND_LOGO_URL) || "/_static/brand/logo.png";

/** Logo for dark backgrounds (sign-in side panel, viewer nav). */
export const BRAND_LOGO_DARK_URL =
  env(process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL) ||
  "/_static/brand/logo-white.svg";

export const BRAND_URL = env(process.env.NEXT_PUBLIC_BRAND_URL) || baseUrl;

/** Suffix for document / data room page titles: "Doc name | <suffix>". */
export const BRAND_TITLE_SUFFIX = BRAND_NAME;

/**
 * Default look for document and data room viewers when a team or data room
 * has not set its own branding: a transparent 1x1 logo, no banner and a
 * light #FAFAFA nav and background. Saved branding always wins.
 */
export const DEFAULT_VIEWER_BRAND = {
  logo: "/_static/brand/transparent-pixel.png",
  banner: "no-banner",
  brandColor: "#FAFAFA",
  accentColor: "#FAFAFA",
} as const;

type BrandFields = {
  logo?: string | null;
  banner?: string | null;
  brandColor?: string | null;
  accentColor?: string | null;
};

/** Fill any empty brand field with the default. */
export function withBrandDefaults<T extends BrandFields>(
  brand: T | null | undefined,
): T & {
  logo: string;
  banner: string;
  brandColor: string;
  accentColor: string;
} {
  const b = (brand ?? {}) as T;
  return {
    ...b,
    logo: b.logo || DEFAULT_VIEWER_BRAND.logo,
    banner: b.banner || DEFAULT_VIEWER_BRAND.banner,
    brandColor: b.brandColor || DEFAULT_VIEWER_BRAND.brandColor,
    accentColor: b.accentColor || DEFAULT_VIEWER_BRAND.accentColor,
  };
}
