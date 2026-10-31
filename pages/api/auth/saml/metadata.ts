import { NextApiRequest, NextApiResponse } from "next";

import { getSaml, samlConfigured } from "@/whitedog/auth/middleauth";

/** SP metadata to register WhiteDog Share in MiddleAuth. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  if (!samlConfigured()) return res.status(404).end();
  res.setHeader("Content-Type", "application/xml");
  return res.status(200).send(getSaml().generateServiceProviderMetadata(null));
}
