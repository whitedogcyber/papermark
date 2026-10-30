import { NextApiRequest, NextApiResponse } from "next";

import { sharePointConfigured } from "@/lib/integrations/sharepoint/graph";
import { renewAllSubscriptions } from "@/lib/integrations/sharepoint/subscriptions";
import { kickSync } from "@/lib/integrations/sharepoint/sync";
import prisma from "@/lib/prisma";

// Called every few minutes by a Kubernetes CronJob:
//   curl -X POST -H "Authorization: Bearer $INTERNAL_API_KEY" \
//     http://papermark/api/integrations/sharepoint/cron
// Renews webhook subscriptions and runs any sync that is flagged or overdue
// (catches missed webhooks and libraries where webhooks aren't allowed).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }
  const key = process.env.INTERNAL_API_KEY;
  if (!key || req.headers.authorization !== `Bearer ${key}`) {
    return res.status(401).end();
  }
  if (!sharePointConfigured()) return res.status(200).json({ skipped: true });

  await renewAllSubscriptions();

  const minutes = Number(process.env.SHAREPOINT_POLL_MINUTES || 15);
  const due = await prisma.sharePointSync.findMany({
    where: {
      OR: [
        { needsSync: true },
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: new Date(Date.now() - minutes * 60_000) } },
      ],
    },
    select: { id: true },
  });
  due.forEach((s) => kickSync(s.id));

  return res.status(202).json({ started: due.length });
}
