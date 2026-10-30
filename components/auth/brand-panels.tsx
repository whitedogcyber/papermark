import {
  BRAND_DESCRIPTION,
  BRAND_LOGO_DARK_URL,
  BRAND_NAME,
  BRAND_PRIVACY_URL,
  BRAND_TERMS_URL,
} from "@/lib/branding";

/** Right-hand panel on sign-in, registration and verification pages. */
export function BrandSidePanel() {
  return (
    <div className="relative hidden w-full flex-col items-center justify-center gap-8 overflow-hidden bg-[radial-gradient(circle_at_30%_50%,#1c1c1c_0%,#0a0a0a_60%)] px-12 md:flex md:w-1/2 lg:w-1/2">
      {BRAND_LOGO_DARK_URL ? (
        <img
          src={BRAND_LOGO_DARK_URL}
          alt={`${BRAND_NAME} Logo`}
          className="h-56 w-56"
        />
      ) : null}
      <div className="max-w-md text-center">
        <p className="text-balance text-4xl font-extrabold tracking-tight text-white">
          {BRAND_NAME}
        </p>
        <p className="mt-4 text-balance text-lg text-gray-400">
          {BRAND_DESCRIPTION}
        </p>
      </div>
    </div>
  );
}

/** "By clicking continue..." line. Hidden when no terms or privacy URL is set. */
export function BrandLegalNotice({ className }: { className?: string }) {
  if (!BRAND_TERMS_URL && !BRAND_PRIVACY_URL) return null;
  return (
    <p
      className={
        className ??
        "mt-10 w-full max-w-md px-4 text-xs text-muted-foreground sm:px-12"
      }
    >
      By clicking continue, you acknowledge that you have read and agree to{" "}
      {BRAND_NAME}&apos;s{" "}
      {BRAND_TERMS_URL ? (
        <a href={BRAND_TERMS_URL} target="_blank" className="underline">
          Terms of Service
        </a>
      ) : null}
      {BRAND_TERMS_URL && BRAND_PRIVACY_URL ? " and " : null}
      {BRAND_PRIVACY_URL ? (
        <a href={BRAND_PRIVACY_URL} target="_blank" className="underline">
          Privacy Policy
        </a>
      ) : null}
      .
    </p>
  );
}
