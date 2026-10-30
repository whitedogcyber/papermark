/**
 * SharePoint sync switch for the UI. Off unless NEXT_PUBLIC_ENABLE_SHAREPOINT
 * is "true" at build time. The server side also needs SHAREPOINT_TENANT_ID,
 * SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET and SHAREPOINT_WEBHOOK_SECRET.
 */
export const SHAREPOINT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_SHAREPOINT === "true";
