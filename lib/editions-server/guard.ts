import { NextApiResponse } from "next";

import { PENDING_MESSAGE, isPendingPlan } from "@/lib/editions";
import prisma from "@/lib/prisma";

/**
 * Teams without an edition can sign in but not create anything. Returns true
 * (after sending 403) when the team is still pending approval.
 */
export async function rejectIfPending(
  teamId: string,
  res: NextApiResponse,
  plan?: string,
): Promise<boolean> {
  const teamPlan =
    plan ??
    (
      await prisma.team.findUnique({
        where: { id: teamId },
        select: { plan: true },
      })
    )?.plan;
  if (teamPlan !== undefined && isPendingPlan(teamPlan)) {
    res.status(403).json({ error: PENDING_MESSAGE, message: PENDING_MESSAGE });
    return true;
  }
  return false;
}
