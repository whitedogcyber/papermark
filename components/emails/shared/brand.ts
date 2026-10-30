/**
 * Branding used in all outgoing emails (templates and subject lines).
 * Defaults are WhiteDog's; override at runtime if needed:
 *
 *   EMAIL_BRAND_NAME       e.g. "WhiteDog Share"
 *   EMAIL_COMPANY_NAME     e.g. "WhiteDog Cyber"
 *   EMAIL_COMPANY_ADDRESS  footer address (set to "" to hide)
 */
export const EMAIL_BRAND =
  process.env.EMAIL_BRAND_NAME?.trim() || "WhiteDog Share";

const companyName = process.env.EMAIL_COMPANY_NAME?.trim() || "WhiteDog Cyber";

// Used as "© 2026 {EMAIL_COMPANY} All rights reserved." so it ends with a period.
export const EMAIL_COMPANY = companyName.endsWith(".")
  ? companyName
  : `${companyName}.`;

export const EMAIL_COMPANY_ADDRESS =
  process.env.EMAIL_COMPANY_ADDRESS !== undefined
    ? process.env.EMAIL_COMPANY_ADDRESS.trim()
    : "590 Laurelwood Road, Santa Clara, CA, 95054";

export const EMAIL_SHOW_ADDRESS = !!EMAIL_COMPANY_ADDRESS;
