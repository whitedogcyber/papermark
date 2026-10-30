import { NextApiRequest, NextApiResponse } from "next";

import { timingSafeEqual } from "node:crypto";

import { sharePointConfigured } from "@/lib/integrations/sharepoint/graph";
import { kickSync } from "@/lib/integrations/sharepoint/sync";
import prisma from "@/lib/prisma";

// Microsoft Graph change notifications for SharePoint drives.
// Graph only says "something in this library changed", so every sync on that
// library is flagged and re-walked. Must answer within a few seconds.

function sameSecret(a: unknown): boolean {
  const secret = process.env.SHAREPOINT_WEBHOOK_SECRET;
  if (!secret || typeof a !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(secret);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Subscription validation handshake.
  const validationToken = req.query.validationToken;
  if (typeof validationToken === "string") {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(validationToken);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  if (!sharePointConfigured()) return res.status(404).end();

  const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
  const subscriptionIds = Array.from(
    new Set<string>(
      notifications
        .filter((n: any) => sameSecret(n?.clientState))
        .map((n: any) => String(n.subscriptionId)),
    ),
  );

  if (subscriptionIds.length) {
    const subs = await prisma.sharePointSubscription.findMany({
      where: { id: { in: subscriptionIds } },
      select: { driveId: true },
    });
    const driveIds = subs.map((s) => s.driveId);
    if (driveIds.length) {
      const syncs = await prisma.sharePointSync.findMany({
        where: { driveId: { in: driveIds } },
        select: { id: true },
      });
      await prisma.sharePointSync.updateMany({
        where: { id: { in: syncs.map((s) => s.id) } },
        data: { needsSync: true },
      });
      // Let SharePoint finish writing (uploads arrive as several events).
      setTimeout(() => syncs.forEach((s) => kickSync(s.id)), 15_000);
    }
  }

  return res.status(202).end();
}
