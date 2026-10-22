/**
 * Slack integration switch. Off unless NEXT_PUBLIC_ENABLE_SLACK=true at build
 * time: hides Slack settings, nav and banner, skips the status check, and
 * makes the Slack pages and API routes respond as not found.
 */
export const SLACK_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SLACK === "true";
