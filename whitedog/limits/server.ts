import prisma from "@/lib/prisma";

import { PlanLimits, effectiveLimits } from "./plan-limits";

export type LimitsWithUsage = PlanLimits & {
  usage: { documents: number; links: number; users: number };
};

/** Limits for a team the user belongs to, with current usage. */
export async function getLimits({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}): Promise<LimitsWithUsage> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, users: { some: { userId } } },
    select: {
      plan: true,
      limits: true,
      _count: {
        select: {
          documents: true,
          links: true,
          users: true,
          invitations: true,
        },
      },
    },
  });
  if (!team) throw new Error("Team not found");

  return {
    ...effectiveLimits(team.plan, team.limits),
    usage: {
      documents: team._count.documents,
      links: team._count.links,
      users: team._count.users + team._count.invitations,
    },
  };
}
