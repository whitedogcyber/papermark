import { NextApiRequest, NextApiResponse } from "next";

import { getSaml, samlConfigured } from "@/whitedog/auth/middleauth";

/** Starts MiddleAuth SAML sign-in. ?callbackUrl= is a path to return to. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!samlConfigured()) return res.status(404).end();
  const callbackUrl =
    typeof req.query.callbackUrl === "string" &&
    req.query.callbackUrl.startsWith("/")
      ? req.query.callbackUrl
      : "/dashboard";
  const url = await getSaml().getAuthorizeUrlAsync(
    callbackUrl,
    req.headers.host,
    {},
  );
  res.redirect(302, url);
}
