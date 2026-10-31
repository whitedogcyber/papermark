import { NextApiRequest, NextApiResponse } from "next";

import { requirePlatformAdmin } from "@/lib/editions-server/admin";
import prisma from "@/lib/prisma";

// GET /api/admin/teams?q=  -> teams matching a team name or a member's email/name
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!(await requirePlatformAdmin(req, res))) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const q = (typeof req.query.q === "string" ? req.query.q : "").trim();
  const plan = typeof req.query.plan === "string" ? req.query.plan : "";

  const teams = await prisma.team.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { id: q },
              {
                users: {
                  some: {
                    user: {
                      OR: [
                        { email: { contains: q, mode: "insensitive" } },
                        { name: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(plan ? { plan: { startsWith: plan } } : {}),
    },
    select: {
      id: true,
      name: true,
      plan: true,
      limits: true,
      createdAt: true,
      users: {
        select: {
          role: true,
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { role: "asc" },
      },
      _count: {
        select: { documents: true, datarooms: true, links: true },
      },
      upgradeRequests: {
        where: { status: "open" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.status(200).json(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      limits: t.limits,
      createdAt: t.createdAt,
      members: t.users.map((u) => ({
        id: u.user.id,
        email: u.user.email,
        name: u.user.name,
        role: u.role,
      })),
      counts: t._count,
      openRequests: t.upgradeRequests.length,
    })),
  );
}
