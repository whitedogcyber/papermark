import useSWR from "swr";

/**
 * Support, help, terms and privacy links. Read from the container's runtime
 * environment (SUPPORT_EMAIL, HELP_URL, TERMS_URL, PRIVACY_URL) so staging
 * and production can differ without a rebuild. Empty = the link is hidden.
 */
export type RuntimeLinks = {
  supportEmail: string;
  helpUrl: string;
  termsUrl: string;
  privacyUrl: string;
};

const EMPTY: RuntimeLinks = {
  supportEmail: "",
  helpUrl: "",
  termsUrl: "",
  privacyUrl: "",
};

/** Server side only. */
export function readRuntimeLinks(): RuntimeLinks {
  const v = (k: string) => process.env[k]?.trim() || "";
  return {
    supportEmail: v("SUPPORT_EMAIL"),
    helpUrl: v("HELP_URL"),
    termsUrl: v("TERMS_URL"),
    privacyUrl: v("PRIVACY_URL"),
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
