import prisma from "@/lib/prisma";

import {
  GraphError,
  createSubscription,
  deleteSubscription,
  renewSubscription,
} from "./graph";

const RENEW_BEFORE_MS = 3 * 24 * 60 * 60_000;

/**
 * Make sure the drive has a live change-notification subscription. Returns
 * false if Graph refuses (the sync then relies on the scheduled poll).
 */
export async function ensureSubscription(driveId: string): Promise<boolean> {
  const existing = await prisma.sharePointSubscription.findUnique({
    where: { driveId },
  });

  try {
    if (
      existing &&
      existing.expiresAt.getTime() > Date.now() + RENEW_BEFORE_MS
    ) {
      return true;
    }
    if (existing) {
      try {
        const renewed = await renewSubscription(existing.id);
        await prisma.sharePointSubscription.update({
          where: { driveId },
          data: { expiresAt: new Date(renewed.expirationDateTime) },
        });
        return true;
      } catch (error) {
        if ((error as GraphError).status !== 404) throw error;
        await prisma.sharePointSubscription.delete({ where: { driveId } });
      }
    }

    const created = await createSubscription(driveId);
    await prisma.sharePointSubscription.create({
      data: {
        id: created.id,
        driveId,
        expiresAt: new Date(created.expirationDateTime),
      },
    });
    return true;
  } catch (error) {
    console.error(
      `SharePoint: could not subscribe to drive ${driveId}; falling back to polling.`,
      (error as Error).message,
    );
    return false;
  }
}

/** Remove the drive's subscription once no sync uses that drive. */
export async function releaseSubscription(driveId: string): Promise<void> {
  const inUse = await prisma.sharePointSync.count({ where: { driveId } });
  if (inUse > 0) return;
  const sub = await prisma.sharePointSubscription.findUnique({
    where: { driveId },
  });
  if (!sub) return;
  await deleteSubscription(sub.id).catch((error) =>
    console.error("SharePoint: failed to delete subscription", error),
  );
  await prisma.sharePointSubscription.deleteMany({ where: { driveId } });
}

export async function renewAllSubscriptions(): Promise<void> {
  const drives = await prisma.sharePointSync.findMany({
    distinct: ["driveId"],
    select: { driveId: true },
  });
  for (const { driveId } of drives) await ensureSubscription(driveId);
}
