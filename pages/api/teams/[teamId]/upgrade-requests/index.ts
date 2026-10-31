import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { EDITIONS } from "@/lib/editions";
import { routeUpgradeRequest } from "@/lib/editions-server/routing";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

const bodySchema = z.object({
  kind: z.enum(["edition", "seats"]).default("edition"),
  edition: z
    .enum(EDITIONS.map((e) => e.id) as [string, ...string[]])
    .optional(),
  seats: z.number().int().min(1).max(1000).optional(),
  message: z.string().max(2000).optional(),
  trigger: z.string().max(100).optional(),
});

// GET  -> this team's open requests
// POST -> request an edition or more seats (updates an open one of the same kind)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const user = session.user as CustomUser;
  const { teamId } = req.query as { teamId: string };

  const team = await prisma.team.findFirst({
    where: { id: teamId, users: { some: { userId: user.id } } },
    select: { id: true, name: true, plan: true },
  });
  if (!team) return res.status(404).json({ error: "Team not found" });

  if (req.method === "GET") {
    const requests = await prisma.upgradeRequest.findMany({
      where: { teamId, status: "open" },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(requests);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const { kind, edition, seats, message, trigger } = parsed.data;
  if (kind === "edition" && !edition) {
    return res.status(400).json({ error: "Choose an edition" });
  }
  if (kind === "seats" && !seats) {
    return res.status(400).json({ error: "Enter the number of team members" });
  }

  const data = {
    kind,
    requestedEdition: kind === "edition" ? edition! : null,
    requestedSeats: kind === "seats" ? seats! : null,
    currentPlan: team.plan,
    message: message?.trim() || null,
    trigger: trigger ?? null,
    requestedById: user.id,
    requestedByEmail: user.email ?? null,
  };

  const existing = await prisma.upgradeRequest.findFirst({
    where: { teamId, status: "open", kind },
    select: { id: true },
  });

  const request = existing
    ? await prisma.upgradeRequest.update({ where: { id: existing.id }, data })
    : await prisma.upgradeRequest.create({ data: { ...data, teamId } });

  await routeUpgradeRequest(request, team);

  return res.status(existing ? 200 : 201).json(request);
}
