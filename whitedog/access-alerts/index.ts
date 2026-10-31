import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/resend";

import BlockedAccessEmail from "./email";

/**
 * Emails the team's admins and managers when a viewer is blocked by an
 * allow list, block list or the team's global block list. One alert per
 * link and email per hour. Never throws.
 */
export async function reportDeniedAccessAttempt(
  link: { id: string } | null | undefined,
  email: string | null | undefined,
  reason: "global" | "allow" | "deny",
): Promise<void> {
  if (!link?.id || !email) return;
  try {
    const key = `access-alert:${link.id}:${email.toLowerCase()}`;
    try {
      const fresh = await redis.set(key, "1", { nx: true, ex: 3600 });
      if (fresh === null) return; // already alerted recently
    } catch {
      // Redis down: still alert
    }

    const record = await prisma.link.findUnique({
      where: { id: link.id },
      select: {
        name: true,
        teamId: true,
        documentId: true,
        dataroomId: true,
        document: { select: { name: true } },
        dataroom: { select: { name: true } },
      },
    });
    if (!record?.teamId) return;

    const managers = await prisma.userTeam.findMany({
      where: {
        teamId: record.teamId,
        role: { in: ["ADMIN", "MANAGER"] },
        status: "ACTIVE",
      },
      select: { user: { select: { email: true } } },
    });
    const recipients = managers
      .map((m) => m.user.email)
      .filter((e): e is string => !!e);
    if (!recipients.length) return;

    const base = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
    const manageUrl = record.dataroomId
      ? `${base}/datarooms/${record.dataroomId}/permissions`
      : `${base}/documents/${record.documentId}`;
    const targetName =
      record.dataroom?.name ?? record.document?.name ?? "your content";

    await Promise.allSettled(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: `${email} was blocked from ${targetName}`,
          react: BlockedAccessEmail({
            viewerEmail: email,
            linkName: record.name || "Untitled link",
            targetName,
            reason,
            manageUrl,
          }),
          system: true,
        }),
      ),
    );
  } catch (error) {
    console.error("Blocked access alert failed:", error);
  }
}
