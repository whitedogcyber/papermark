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

/** Absolute URL of the preview image; empty means no image. */
export const BRAND_IMAGE_URL =
  process.env.NEXT_PUBLIC_BRAND_IMAGE_URL?.trim() ??
  (name ? "" : "https://www.papermark.com/_static/meta-image.png");

export const BRAND_URL =
  process.env.NEXT_PUBLIC_BRAND_URL?.trim() ||
  (name ? process.env.NEXT_PUBLIC_BASE_URL || "" : "https://www.papermark.com");

/** Suffix for document / data room page titles: "Doc name | <suffix>". */
export const BRAND_TITLE_SUFFIX = name ? name : "Powered by Papermark";
