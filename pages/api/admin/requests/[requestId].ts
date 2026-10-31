import { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { editionById, planDisplayName } from "@/lib/editions";
import { requirePlatformAdmin } from "@/lib/editions-server/admin";
import { changeTeamPlan } from "@/lib/editions-server/change-plan";
import {
  describeRequest,
  notifyRequester,
} from "@/lib/editions-server/routing";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["approve", "decline"]),
  // Approve with a different edition than requested (optional).
  edition: z.string().optional(),
  note: z.string().max(2000).optional(),
});

// PATCH /api/admin/requests/:requestId  { action, edition?, note? }
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end();
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { action, note } = parsed.data;

  const { requestId } = req.query as { requestId: string };
  const request = await prisma.upgradeRequest.findUnique({
    where: { id: requestId },
    include: { team: { select: { id: true, name: true, limits: true } } },
  });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "open") {
    return res.status(409).json({ error: "Request already resolved" });
  }

  let granted = describeRequest(request);

  if (action === "approve") {
    if (request.kind === "seats") {
      const current = (request.team.limits ?? {}) as Record<string, unknown>;
      await changeTeamPlan({
        teamId: request.teamId,
        limits: { ...current, users: request.requestedSeats },
        changedBy: { id: admin.id, email: admin.email },
        reason: note ?? "Seat request approved",
        requestId: request.id,
      });
    } else {
      const edition = editionById(
        parsed.data.edition ?? request.requestedEdition,
      );
      if (!edition) return res.status(400).json({ error: "Unknown edition" });
      await changeTeamPlan({
        teamId: request.teamId,
        plan: edition.plan,
        changedBy: { id: admin.id, email: admin.email },
        reason: note ?? "Edition request approved",
        requestId: request.id,
      });
      granted = planDisplayName(edition.plan);
    }
  }

  const updated = await prisma.upgradeRequest.update({
    where: { id: request.id },
    data: {
      status: action === "approve" ? "approved" : "declined",
      resolvedById: admin.id,
      resolvedAt: new Date(),
      resolutionNote: note ?? null,
    },
  });

  await notifyRequester({
    to: request.requestedByEmail,
    teamName: request.team.name,
    requested: granted,
    approved: action === "approve",
    note,
  });

  return res.status(200).json(updated);
}
