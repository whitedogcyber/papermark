import { NextApiRequest, NextApiResponse } from "next";

import { requireSharePointManager } from "@/lib/integrations/sharepoint/api-auth";
import { releaseSubscription } from "@/lib/integrations/sharepoint/subscriptions";
import { kickSync } from "@/lib/integrations/sharepoint/sync";
import prisma from "@/lib/prisma";

// POST   -> sync now
// DELETE -> unlink. Documents already in the data room stay where they are.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {
    teamId,
    id: dataroomId,
    syncId,
  } = req.query as {
    teamId: string;
    id: string;
    syncId: string;
  };
  if (!(await requireSharePointManager(req, res, teamId))) return;

  const sync = await prisma.sharePointSync.findFirst({
    where: { id: syncId, dataroomId, teamId },
    select: { id: true, driveId: true },
  });
  if (!sync) return res.status(404).json({ error: "Sync not found" });

  if (req.method === "POST") {
    await prisma.sharePointSync.update({
      where: { id: sync.id },
      data: { needsSync: true },
    });
    kickSync(sync.id);
    return res.status(202).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await prisma.sharePointSync.delete({ where: { id: sync.id } });
    await releaseSubscription(sync.driveId);
    return res.status(204).end();
  }

  res.setHeader("Allow", ["POST", "DELETE"]);
  return res.status(405).end();
}
