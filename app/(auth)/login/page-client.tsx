"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useEffect, useState } from "react";

import { signInWithPasskey } from "@teamhanko/passkeys-next-auth-provider/client";
import { KeyRoundIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";

import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/branding";
import { useRuntimeLinks } from "@/lib/runtime-links";
import { cn } from "@/lib/utils";

import {
  BrandLegalNotice,
  BrandSidePanel,
} from "@/components/auth/brand-panels";
import { LastUsed, useLastUsed } from "@/components/hooks/useLastUsed";
import Passkey from "@/components/shared/icons/passkey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { next } = useParams as { next?: string };

  const [lastUsed, setLastUsed] = useLastUsed();
  const authMethods = ["email", "sso", "passkey"] as const;
  type AuthMethod = (typeof authMethods)[number];
  const [clickedMethod, setClickedMethod] = useState<AuthMethod | undefined>(
    undefined,
  );
  const [email, setEmail] = useState<string>("");
  const { passkeyTenantId } = useRuntimeLinks();

  // Which MiddleAuth provider (if any) the server has configured.
  const [ssoProvider, setSsoProvider] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers: Record<string, unknown>) => {
        if (providers?.["middleauth"]) setSsoProvider("middleauth");
        else if (providers?.["middleauth-saml"])
          setSsoProvider("middleauth-saml");
      })
      .catch(() => {});
  }, []);
  const [emailButtonText, setEmailButtonText] = useState<string>(
    "Continue with Email",
  );

  const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { message: "Please enter a valid email." })
    .email({ message: "Please enter a valid email." });

  const emailValidation = emailSchema.safeParse(email);

  return (
    <div className="flex h-screen w-full flex-wrap">
      {/* Left part */}
      <div className="flex w-full justify-center bg-gray-50 md:w-1/2 lg:w-1/2">
        <div
          className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
          aria-hidden="true"
        ></div>
        <div className="z-10 mx-5 mt-[calc(1vh)] h-fit w-full max-w-md overflow-hidden rounded-lg sm:mx-0 sm:mt-[calc(2vh)] md:mt-[calc(3vh)]">
          <div className="items-left flex flex-col space-y-3 px-4 py-6 pt-8 sm:px-12">
            <img
              src={BRAND_LOGO_URL}
              alt={`${BRAND_NAME} Logo`}
              className={cn(
                "md:mb-48s -mt-8 mb-36 w-auto self-start sm:mb-32",
                "h-14",
              )}
            />
            <Link href="/">
              <span className="text-balance text-3xl font-semibold text-gray-900">
                Welcome to {BRAND_NAME}
              </span>
            </Link>
            <h3 className="text-balance text-sm text-gray-800">
              Share documents. Not attachments.
            </h3>
          </div>
          <form
            className="flex flex-col gap-4 px-4 pt-8 sm:px-12"
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailValidation.success) {
                toast.error(emailValidation.error.errors[0].message);
                return;
              }

              setClickedMethod("email");
              signIn("email", {
                email: emailValidation.data,
                redirect: false,
                ...(next && next.length > 0 ? { callbackUrl: next } : {}),
              }).then((res) => {
                if (res?.ok && !res?.error) {
                  setEmail("");
                  setLastUsed("credentials");
                  setEmailButtonText("Email sent - check your inbox!");
                  toast.success("Email sent - check your inbox!");
                } else {
                  setEmailButtonText("Error sending email - try again?");
                  toast.error("Error sending email - try again?");
                }
                setClickedMethod(undefined);
              });
            }}
          >
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={clickedMethod === "email"}
              // pattern={patternSimpleEmailRegex}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "flex h-10 w-full rounded-md border-0 bg-background bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white",
                email.length > 0 && !emailValidation.success
                  ? "ring-red-500"
                  : "ring-gray-200",
              )}
            />
            <div className="relative">
              <Button
                type="submit"
                loading={clickedMethod === "email"}
                disabled={!emailValidation.success || !!clickedMethod}
                className={cn(
                  "focus:shadow-outline w-full transform rounded px-4 py-2 text-white transition-colors duration-300 ease-in-out focus:outline-none",
                  clickedMethod === "email"
                    ? "bg-black"
                    : "bg-gray-800 hover:bg-gray-900",
                )}
              >
                {emailButtonText}
              </Button>
              {lastUsed === "credentials" && <LastUsed />}
            </div>
          </form>
          {ssoProvider || passkeyTenantId ? (
            <>
              <p className="py-4 text-center">or</p>
              <div className="flex flex-col space-y-2 px-4 sm:px-12">
                {ssoProvider ? (
                  <div className="relative">
                    <Button
                      onClick={() => {
                        setClickedMethod("sso");
                        setLastUsed("sso");
                        const callbackUrl =
                          next && next.length > 0 ? next : "/dashboard";
                        if (ssoProvider === "middleauth-saml") {
                          window.location.href = `/api/auth/saml/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
                        } else {
                          signIn("middleauth", { callbackUrl });
                        }
                      }}
                      loading={clickedMethod === "sso"}
                      disabled={clickedMethod && clickedMethod !== "sso"}
                      className="flex w-full items-center justify-center space-x-2 border border-gray-300 bg-gray-100 font-normal text-gray-900 hover:bg-gray-200"
                    >
                      <KeyRoundIcon className="h-4 w-4" />
                      <span>Continue with MiddleAuth</span>
                      {clickedMethod !== "sso" && lastUsed === "sso" && (
                        <LastUsed />
                      )}
                    </Button>
                  </div>
                ) : null}
                {passkeyTenantId ? (
                  <div className="relative">
                    <Button
                      onClick={() => {
                        setLastUsed("passkey");
                        setClickedMethod("passkey");
                        signInWithPasskey({
                          tenantId: passkeyTenantId,
                          ...(next && next.length > 0
                            ? { callbackUrl: next }
                            : {}),
                        }).then(() => {
                          setClickedMethod(undefined);
                        });
                      }}
                      variant="outline"
                      loading={clickedMethod === "passkey"}
                      disabled={clickedMethod && clickedMethod !== "passkey"}
                      className="flex w-full items-center justify-center space-x-2 border border-gray-300 bg-gray-100 font-normal text-gray-900 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <Passkey className="h-4 w-4" />
                      <span>Continue with a passkey</span>
                      {lastUsed === "passkey" && <LastUsed />}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <BrandLegalNotice />
        </div>
      </div>
      <BrandSidePanel />
    </div>
  );
}
