"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useState } from "react";

import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { BRAND_LOGO_URL, BRAND_NAME } from "@/lib/branding";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Register() {
  const { next } = useParams as { next?: string };

  const [email, setEmail] = useState<string>("");

  return (
    <div className="flex h-screen w-full justify-center">
      <div
        className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-[#80caff] to-[#4f46e5] opacity-20"
          style={{
            clipPath:
              "polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 82.2%, 92.5% 84.9%, 75.7% 64%, 55.3% 47.5%, 46.5% 49.4%, 45% 62.9%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 73.6% 51.7%)",
          }}
        />
      </div>
      <div className="z-10 mx-5 mt-[calc(20vh)] h-fit w-full max-w-md overflow-hidden rounded-lg border border-border bg-gray-50 dark:bg-gray-900 sm:mx-0 sm:shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 px-4 py-6 pt-8 text-center sm:px-16">
          <Link href="/">
            <img
              src={BRAND_LOGO_URL}
              alt={`${BRAND_NAME} Logo`}
              className="h-14 w-auto"
            />
          </Link>
          <h3 className="text-2xl font-medium text-foreground">
            Start sharing documents
          </h3>
        </div>
        <form
          className="flex flex-col gap-4 p-4 pt-8 sm:px-16"
          onSubmit={(e) => {
            e.preventDefault();
            signIn("email", {
              email: email,
              redirect: false,
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            }).then((res) => {
              if (res?.ok && !res?.error) {
                setEmail("");
                toast.success("Email sent - check your inbox!");
              } else {
                toast.error("Error sending email - try again?");
              }
            });
          }}
        >
          <Input
            className="border-4"
            placeholder="jsmith@company.co"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit">Continue with Email</Button>
        </form>
        <p className="px-4 pb-8 text-center text-sm text-muted-foreground sm:px-16">
          Using MiddleAuth?{" "}
          <Link href="/login" className="underline">
            Sign in here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
