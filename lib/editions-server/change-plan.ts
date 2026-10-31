import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

/**
 * Sets a team's plan and/or limit overrides and records the change.
 * `limits` replaces the stored overrides (null clears them).
 */
export async function changeTeamPlan({
  teamId,
  plan,
  limits,
  changedBy,
  reason,
  requestId,
}: {
  teamId: string;
  plan?: string;
  limits?: Record<string, unknown> | null;
  changedBy: { id?: string; email?: string | null };
  reason?: string | null;
  requestId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.findUniqueOrThrow({
      where: { id: teamId },
      select: { plan: true, limits: true },
    });

    const nextPlan = plan ?? team.plan;
    const nextLimits =
      limits === undefined ? team.limits : (limits as Prisma.JsonValue);

    const updated = await tx.team.update({
      where: { id: teamId },
      data: {
        plan: nextPlan,
        ...(limits !== undefined
          ? {
              limits:
                limits === null || Object.keys(limits).length === 0
                  ? Prisma.DbNull
                  : (limits as Prisma.InputJsonValue),
            }
          : {}),
      },
      select: { id: true, name: true, plan: true, limits: true },
    });

    await tx.planChange.create({
      data: {
        teamId,
        fromPlan: team.plan,
        toPlan: nextPlan,
        fromLimits: (team.limits ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        toLimits: (nextLimits ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        changedById: changedBy.id,
        changedByEmail: changedBy.email ?? null,
        reason: reason ?? null,
        requestId: requestId ?? null,
      },
    });

    return updated;
  });
}
