import { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { EDITIONS, LEGACY_PLANS, PENDING_PLAN } from "@/lib/editions";
import { requirePlatformAdmin } from "@/lib/editions-server/admin";
import { changeTeamPlan } from "@/lib/editions-server/change-plan";
import prisma from "@/lib/prisma";

const ASSIGNABLE_PLANS = [
  PENDING_PLAN,
  ...EDITIONS.map((e) => e.plan),
  ...Object.keys(LEGACY_PLANS), // keep legacy teams editable
];

const limitValue = z.union([z.number().int().min(0), z.null()]).optional();
const bodySchema = z.object({
  plan: z.string().optional(),
  // Overrides on top of the edition. Omitted = keep; null = clear all.
  limits: z
    .object({
      users: limitValue,
      datarooms: limitValue,
      domains: limitValue,
      documents: limitValue,
      links: limitValue,
    })
    .nullable()
    .optional(),
  reason: z.string().max(500).optional(),
});

// GET   -> team details with plan history and requests
// PATCH -> change plan and/or limit overrides
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;
  const { teamId } = req.query as { teamId: string };

  if (req.method === "GET") {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        plan: true,
        limits: true,
        createdAt: true,
        planChanges: { orderBy: { createdAt: "desc" }, take: 20 },
        upgradeRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!team) return res.status(404).json({ error: "Team not found" });
    return res.status(200).json(team);
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["GET", "PATCH"]);
    return res.status(405).end();
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { plan, limits, reason } = parsed.data;

  if (plan !== undefined && !ASSIGNABLE_PLANS.includes(plan)) {
    return res.status(400).json({ error: "Unknown plan" });
  }

  // Drop empty overrides so the edition default applies.
  const cleaned =
    limits === undefined
      ? undefined
      : limits === null
        ? null
        : Object.fromEntries(
            Object.entries(limits).filter(
              ([, v]) => v !== null && v !== undefined,
            ),
          );

  try {
    const team = await changeTeamPlan({
      teamId,
      plan,
      limits: cleaned,
      changedBy: { id: admin.id, email: admin.email },
      reason,
    });
    return res.status(200).json(team);
  } catch (error) {
    console.error("Plan change failed:", error);
    return res.status(404).json({ error: "Team not found" });
  }
}
