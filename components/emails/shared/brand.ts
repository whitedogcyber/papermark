/**
 * Branding used in all outgoing emails (templates and subject lines).
 *
 *   EMAIL_BRAND_NAME       replaces "Papermark"            e.g. "WhiteDog Share"
 *   EMAIL_COMPANY_NAME     replaces "Papermark, Inc."      e.g. "WhiteDog, Inc."
 *   EMAIL_COMPANY_ADDRESS  footer address (blank to hide)
 *
 * With nothing set, emails are unchanged from upstream.
 */
const brandOverride = process.env.EMAIL_BRAND_NAME?.trim();

export const EMAIL_BRAND = brandOverride || "Papermark";

const companyName =
  process.env.EMAIL_COMPANY_NAME?.trim() ||
  (brandOverride ? brandOverride : "Papermark, Inc.");

// Used as "© 2026 {EMAIL_COMPANY} All rights reserved." so it must end
// with a period ("Papermark, Inc." already does; "WhiteDog Cyber" does not).
export const EMAIL_COMPANY = companyName.endsWith(".")
  ? companyName
  : `${companyName}.`;

export const EMAIL_COMPANY_ADDRESS =
  process.env.EMAIL_COMPANY_ADDRESS !== undefined
    ? process.env.EMAIL_COMPANY_ADDRESS.trim()
    : brandOverride
      ? ""
      : "1111B S Governors Ave #28117, Dover, DE 19904";

// When an address is configured explicitly, show it in every footer.
export const EMAIL_SHOW_ADDRESS = !!process.env.EMAIL_COMPANY_ADDRESS?.trim();
