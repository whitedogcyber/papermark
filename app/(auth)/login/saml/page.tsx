"use client";

import { useSearchParams } from "next/navigation";

import { Suspense, useEffect } from "react";

import { signIn } from "next-auth/react";

/** Finishes MiddleAuth SAML sign-in by redeeming the one-time ticket. */
function SamlFinish() {
  const params = useSearchParams();

  useEffect(() => {
    const ticket = params?.get("ticket");
    const callbackUrl = params?.get("callbackUrl") || "/dashboard";
    if (!ticket) {
      window.location.replace("/login");
      return;
    }
    signIn("middleauth-saml", {
      ticket,
      callbackUrl: callbackUrl.startsWith("/") ? callbackUrl : "/dashboard",
    });
  }, [params]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
}

export default function SamlFinishPage() {
  return (
    <Suspense fallback={null}>
      <SamlFinish />
    </Suspense>
  );
}
