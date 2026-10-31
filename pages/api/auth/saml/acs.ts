import { NextApiRequest, NextApiResponse } from "next";

import {
  emailFromProfile,
  getSaml,
  issueSamlTicket,
  nameFromProfile,
  samlConfigured,
} from "@/whitedog/auth/middleauth";

/** SAML assertion consumer service: MiddleAuth posts the signed response here. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!samlConfigured()) return res.status(404).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  try {
    const { profile } = await getSaml().validatePostResponseAsync(
      req.body as Record<string, string>,
    );
    const email = profile ? emailFromProfile(profile) : null;
    if (!profile || !email) {
      return res.redirect(302, "/login?error=SamlNoEmail");
    }
    const ticket = await issueSamlTicket(email, nameFromProfile(profile));
    const relay =
      typeof req.body?.RelayState === "string" ? req.body.RelayState : "";
    const callbackUrl =
      relay.startsWith("/") && !relay.startsWith("//") ? relay : "/dashboard";
    return res.redirect(
      302,
      `/login/saml?ticket=${ticket}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  } catch (error) {
    console.error("MiddleAuth SAML response rejected:", error);
    return res.redirect(302, "/login?error=SamlInvalid");
  }
}
