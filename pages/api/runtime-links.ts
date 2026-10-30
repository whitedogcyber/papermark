import { NextApiRequest, NextApiResponse } from "next";

import { readRuntimeLinks } from "@/lib/runtime-links";

// Public: these links are shown on sign-in and viewer pages.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json(readRuntimeLinks());
}
