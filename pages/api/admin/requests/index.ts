import { NextApiRequest, NextApiResponse } from "next";

import { requirePlatformAdmin } from "@/lib/editions-server/admin";
import prisma from "@/lib/prisma";

// GET /api/admin/requests?status=open|approved|declined|all
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!(await requirePlatformAdmin(req, res))) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const status =
    typeof req.query.status === "string" ? req.query.status : "open";

  const requests = await prisma.upgradeRequest.findMany({
    where: status === "all" ? {} : { status },
    include: {
      team: { select: { id: true, name: true, plan: true, limits: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.status(200).json(requests);
}
