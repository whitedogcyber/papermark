/**
 * Public-facing branding for page titles and link previews (Open Graph /
 * Twitter cards). NEXT_PUBLIC_* values are compiled in at build time
 * (see Dockerfile build args). With none set, upstream Papermark defaults.
 */
const name = process.env.NEXT_PUBLIC_BRAND_NAME?.trim();

export const IS_CUSTOM_BRAND = !!name;

export const BRAND_NAME = name || "Papermark";

export const BRAND_TITLE =
  process.env.NEXT_PUBLIC_BRAND_TITLE?.trim() ||
  (name ? name : "Papermark | The Open Source DocSend Alternative");

export const BRAND_DESCRIPTION =
  process.env.NEXT_PUBLIC_BRAND_DESCRIPTION?.trim() ||
  (name
    ? `Secure document sharing by ${name}.`
    : "Papermark is an open-source document sharing alternative to DocSend with built-in analytics.");

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const absolute = (u: string) => (u.startsWith("/") ? `${baseUrl}${u}` : u);

/** Absolute URL of the preview image; empty means no image. */
export const BRAND_IMAGE_URL = absolute(
  process.env.NEXT_PUBLIC_BRAND_IMAGE_URL?.trim() ??
    (name ? "" : "https://www.papermark.com/_static/meta-image.png"),
);

/** Logo for light backgrounds (sign-in, registration). */
export const BRAND_LOGO_URL =
  process.env.NEXT_PUBLIC_BRAND_LOGO_URL?.trim() ||
  (name ? "/_static/brand/logo.png" : "/_static/papermark-logo.svg");

/** Logo for dark backgrounds (sign-in side panel). */
export const BRAND_LOGO_DARK_URL =
  process.env.NEXT_PUBLIC_BRAND_LOGO_DARK_URL?.trim() ||
  (name ? "/_static/brand/logo-white.svg" : "");

/** Terms / privacy links on sign-in. Hidden for a custom brand unless set. */
export const BRAND_TERMS_URL =
  process.env.NEXT_PUBLIC_BRAND_TERMS_URL?.trim() ||
  (name ? "" : `${process.env.NEXT_PUBLIC_MARKETING_URL}/terms`);
export const BRAND_PRIVACY_URL =
  process.env.NEXT_PUBLIC_BRAND_PRIVACY_URL?.trim() ||
  (name ? "" : `${process.env.NEXT_PUBLIC_MARKETING_URL}/privacy`);

export const BRAND_URL =
  process.env.NEXT_PUBLIC_BRAND_URL?.trim() ||
  (name ? process.env.NEXT_PUBLIC_BASE_URL || "" : "https://www.papermark.com");

/** Suffix for document / data room page titles: "Doc name | <suffix>". */
export const BRAND_TITLE_SUFFIX = name ? name : "Powered by Papermark";
