import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import { CustomUser } from "@/lib/types";

import { getLimits } from "./server";

// GET /api/teams/:teamId/limits
export default async function limitsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).end("Unauthorized");
  const { teamId } = req.query as { teamId: string };
  try {
    const limits = await getLimits({
      teamId,
      userId: (session.user as CustomUser).id,
    });
    // Infinity becomes null in JSON = unlimited
    return res.status(200).json(limits);
  } catch {
    return res.status(404).json({ error: "Team not found" });
  }
}
