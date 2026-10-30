/**
 * Upstream Papermark sends onboarding, trial, check-in and milestone emails
 * written by its founders. They are off in this fork unless
 * ENABLE_MARKETING_EMAILS=true.
 */
export const MARKETING_EMAILS_ENABLED =
  process.env.ENABLE_MARKETING_EMAILS === "true";
