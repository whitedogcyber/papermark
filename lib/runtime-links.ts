import useSWR from "swr";

/**
 * Support, help, terms and privacy links. Read from the container's runtime
 * environment (SUPPORT_EMAIL, HELP_URL, TERMS_URL, PRIVACY_URL, HANKO_*) so staging
 * and production can differ without a rebuild. Empty = the link is hidden.
 */
export type RuntimeLinks = {
  supportEmail: string;
  helpUrl: string;
  termsUrl: string;
  privacyUrl: string;
  /** Hanko tenant for passkey sign-in; empty = passkeys off. */
  passkeyTenantId: string;
};

const EMPTY: RuntimeLinks = {
  supportEmail: "",
  helpUrl: "",
  termsUrl: "",
  privacyUrl: "",
  passkeyTenantId: "",
};

/** Server side only. */
export function readRuntimeLinks(): RuntimeLinks {
  const v = (k: string) => process.env[k]?.trim() || "";
  return {
    supportEmail: v("SUPPORT_EMAIL"),
    helpUrl: v("HELP_URL"),
    termsUrl: v("TERMS_URL"),
    privacyUrl: v("PRIVACY_URL"),
    // Same rule as lib/hanko.ts (not imported: this file ships to the browser).
    passkeyTenantId:
      v("HANKO_API_KEY") &&
      (v("HANKO_TENANT_ID") || v("NEXT_PUBLIC_HANKO_TENANT_ID")) !== "dummy"
        ? v("HANKO_TENANT_ID") || v("NEXT_PUBLIC_HANKO_TENANT_ID")
        : "",
  };
}

const fetchLinks = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : EMPTY));

/** Browser hook; returns empty links until loaded, so nothing flashes. */
export function useRuntimeLinks(): RuntimeLinks {
  const { data } = useSWR<RuntimeLinks>("/api/runtime-links", fetchLinks, {
    revalidateOnFocus: false,
    dedupingInterval: 10 * 60_000,
  });
  return data ?? EMPTY;
}
