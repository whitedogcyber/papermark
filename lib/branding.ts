/**
 * Public-facing branding: page titles, link previews, logos and links.
 * NEXT_PUBLIC_* values are compiled in at build time (see Dockerfile build
 * args). Defaults are WhiteDog Share.
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

/** Terms / privacy / help links. Hidden when empty. */
export const BRAND_TERMS_URL = env(process.env.NEXT_PUBLIC_BRAND_TERMS_URL);
export const BRAND_PRIVACY_URL = env(process.env.NEXT_PUBLIC_BRAND_PRIVACY_URL);
export const BRAND_HELP_URL = env(process.env.NEXT_PUBLIC_BRAND_HELP_URL);

/** Support contact in menus and error screens. Hidden when empty. */
export const BRAND_SUPPORT_EMAIL = env(
  process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL,
);

export const BRAND_URL = env(process.env.NEXT_PUBLIC_BRAND_URL) || baseUrl;

/** Suffix for document / data room page titles: "Doc name | <suffix>". */
export const BRAND_TITLE_SUFFIX = BRAND_NAME;
