import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { SHAREPOINT_ENABLED } from "./enabled";
import { sharePointConfigured } from "./graph";

/**
 * Linking SharePoint folders is limited to team admins and managers. Returns
 * the user id, or null after sending the error response.
 */
export async function requireSharePointManager(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string,
): Promise<string | null> {
  if (!SHAREPOINT_ENABLED || !sharePointConfigured()) {
    res.status(404).json({ error: "SharePoint sync is not enabled" });
    return null;
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).end("Unauthorized");
    return null;
  }
  const userId = (session.user as CustomUser).id;
  const membership = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    res.status(401).end("Unauthorized");
    return null;
  }
  if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
    res
      .status(403)
      .json({ error: "Only admins and managers can manage SharePoint sync" });
    return null;
  }
  return userId;
}
