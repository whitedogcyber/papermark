import { type Profile, SAML } from "@node-saml/node-saml";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers/index";
import crypto from "node:crypto";

import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

/**
 * MiddleAuth single sign-on for team members.
 *
 * OIDC (preferred):
 *   MIDDLEAUTH_OIDC_ISSUER, MIDDLEAUTH_OIDC_CLIENT_ID, MIDDLEAUTH_OIDC_CLIENT_SECRET
 *   Redirect URI to register: <NEXTAUTH_URL>/api/auth/callback/middleauth
 *
 * SAML 2.0 (used when OIDC is not configured):
 *   MIDDLEAUTH_SAML_ENTRY_POINT   IdP single sign-on URL
 *   MIDDLEAUTH_SAML_IDP_CERT      IdP signing certificate (PEM, or several
 *                                 separated by "|||")
 *   MIDDLEAUTH_SAML_ISSUER        optional SP entity ID
 *                                 (default <NEXTAUTH_URL>/api/auth/saml/metadata)
 *   ACS URL to register: <NEXTAUTH_URL>/api/auth/saml/acs
 *
 * Accounts are matched by email, so people who used email sign-in before
 * keep their account.
 */

const env = (k: string) => process.env[k]?.trim() || "";
const appUrl = () => env("NEXTAUTH_URL").replace(/\/+$/, "");

export const MIDDLEAUTH_OIDC_ID = "middleauth";
export const MIDDLEAUTH_SAML_ID = "middleauth-saml";

export const oidcConfigured = () =>
  !!(
    env("MIDDLEAUTH_OIDC_ISSUER") &&
    env("MIDDLEAUTH_OIDC_CLIENT_ID") &&
    env("MIDDLEAUTH_OIDC_CLIENT_SECRET")
  );

export const samlConfigured = () =>
  !oidcConfigured() &&
  !!(env("MIDDLEAUTH_SAML_ENTRY_POINT") && env("MIDDLEAUTH_SAML_IDP_CERT"));

export function samlIssuer() {
  return env("MIDDLEAUTH_SAML_ISSUER") || `${appUrl()}/api/auth/saml/metadata`;
}

export function getSaml(): SAML {
  const certs = env("MIDDLEAUTH_SAML_IDP_CERT")
    .split("|||")
    .map((c) => c.trim())
    .filter(Boolean);
  return new SAML({
    entryPoint: env("MIDDLEAUTH_SAML_ENTRY_POINT"),
    idpCert: certs.length === 1 ? certs[0] : certs,
    issuer: samlIssuer(),
    callbackUrl: `${appUrl()}/api/auth/saml/acs`,
    audience: samlIssuer(),
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    acceptedClockSkewMs: 60_000,
  });
}

export function emailFromProfile(p: Profile): string | null {
  const candidates = [
    p.email,
    p.mail,
    p["urn:oid:0.9.2342.19200300.100.1.3"],
    p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
    p.nameID,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
      return c.toLowerCase();
    }
  }
  return null;
}

export function nameFromProfile(p: Profile): string | null {
  const v =
    p.displayName ??
    p["http://schemas.microsoft.com/identity/claims/displayname"] ??
    p.name ??
    [p.givenName, p.surname].filter(Boolean).join(" ");
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const TICKET_TTL_S = 120;

/** One-time ticket handed from the SAML ACS to the NextAuth sign-in. */
export async function issueSamlTicket(email: string, name: string | null) {
  const ticket = crypto.randomBytes(32).toString("hex");
  await redis.set(`saml-ticket:${ticket}`, JSON.stringify({ email, name }), {
    ex: TICKET_TTL_S,
  });
  return ticket;
}

async function redeemSamlTicket(ticket: string) {
  if (!/^[a-f0-9]{64}$/.test(ticket)) return null;
  const raw = await redis.getdel<
    string | { email: string; name: string | null }
  >(`saml-ticket:${ticket}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

/** NextAuth providers for whichever MiddleAuth protocol is configured. */
export function middleAuthProviders(): Provider[] {
  if (oidcConfigured()) {
    const issuer = env("MIDDLEAUTH_OIDC_ISSUER").replace(/\/+$/, "");
    return [
      {
        id: MIDDLEAUTH_OIDC_ID,
        name: "MiddleAuth",
        type: "oauth",
        wellKnown: `${issuer}/.well-known/openid-configuration`,
        clientId: env("MIDDLEAUTH_OIDC_CLIENT_ID"),
        clientSecret: env("MIDDLEAUTH_OIDC_CLIENT_SECRET"),
        authorization: { params: { scope: "openid email profile" } },
        idToken: true,
        checks: ["pkce", "state"],
        allowDangerousEmailAccountLinking: true,
        profile(profile: Record<string, any>) {
          return {
            id: profile.sub,
            name: profile.name ?? profile.preferred_username ?? null,
            email: profile.email?.toLowerCase() ?? null,
            image: profile.picture ?? null,
          };
        },
      } as Provider,
    ];
  }

  if (samlConfigured()) {
    return [
      CredentialsProvider({
        id: MIDDLEAUTH_SAML_ID,
        name: "MiddleAuth",
        credentials: { ticket: { label: "ticket", type: "text" } },
        async authorize(credentials) {
          const data = await redeemSamlTicket(credentials?.ticket ?? "");
          if (!data?.email) return null;
          const user = await prisma.user.upsert({
            where: { email: data.email },
            create: {
              email: data.email,
              name: data.name,
              emailVerified: new Date(),
            },
            update: data.name ? { name: data.name } : {},
          });
          return user;
        },
      }),
    ];
  }

  return [];
}
