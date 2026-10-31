import { createHmac } from "node:crypto";

import { editionById, planDisplayName } from "@/lib/editions";
import { sendEmail } from "@/lib/resend";

import UpgradeRequestEmail from "@/components/emails/upgrade-request";
import UpgradeRequestResolvedEmail from "@/components/emails/upgrade-request-resolved";

import { platformAdminEmails } from "./admin";

/**
 * Where upgrade requests go. Every request is stored first; routing is
 * best effort and configured with environment variables:
 *
 *   UPGRADE_REQUEST_EMAILS          comma-separated recipients
 *                                   (default: PLATFORM_ADMIN_EMAILS)
 *   UPGRADE_REQUEST_WEBHOOK_URL     POSTs a JSON payload (Power Automate,
 *                                   Teams workflow, CRM, ticketing, ...)
 *   UPGRADE_REQUEST_WEBHOOK_SECRET  optional; adds X-WhiteDog-Signature
 *                                   (hex HMAC-SHA256 of the body)
 */

type RoutedRequest = {
  id: string;
  kind: string;
  requestedEdition: string | null;
  requestedSeats: number | null;
  currentPlan: string;
  message: string | null;
  trigger: string | null;
  requestedByEmail: string | null;
  createdAt: Date;
};

type RoutedTeam = { id: string; name: string };

const appUrl = () =>
  (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(
    /\/+$/,
    "",
  );

export function describeRequest(r: {
  kind: string;
  requestedEdition: string | null;
  requestedSeats: number | null;
}): string {
  if (r.kind === "seats") return `${r.requestedSeats ?? "more"} team members`;
  return editionById(r.requestedEdition)?.name ?? "an edition";
}

export async function routeUpgradeRequest(
  request: RoutedRequest,
  team: RoutedTeam,
): Promise<void> {
  const requested = describeRequest(request);
  const current = planDisplayName(request.currentPlan);
  const reviewUrl = `${appUrl()}/admin?request=${request.id}`;

  const recipients = (
    process.env.UPGRADE_REQUEST_EMAILS
      ? process.env.UPGRADE_REQUEST_EMAILS.split(",")
      : platformAdminEmails()
  )
    .map((e) => e.trim())
    .filter(Boolean);

  const jobs: Promise<unknown>[] = recipients.map((to) =>
    sendEmail({
      to,
      subject: `${team.name} requested ${requested}`,
      react: UpgradeRequestEmail({
        teamName: team.name,
        requesterEmail: request.requestedByEmail ?? "A team member",
        currentEdition: current,
        requested,
        message: request.message,
        reviewUrl,
      }),
      system: true,
    }),
  );

  const webhook = process.env.UPGRADE_REQUEST_WEBHOOK_URL;
  if (webhook) {
    const body = JSON.stringify({
      event: "upgrade_request.created",
      request: {
        id: request.id,
        kind: request.kind,
        requestedEdition: request.requestedEdition,
        requestedEditionName: requested,
        requestedSeats: request.requestedSeats,
        currentPlan: request.currentPlan,
        currentEditionName: current,
        message: request.message,
        trigger: request.trigger,
        requestedByEmail: request.requestedByEmail,
        createdAt: request.createdAt.toISOString(),
      },
      team: { id: team.id, name: team.name },
      reviewUrl,
    });
    const secret = process.env.UPGRADE_REQUEST_WEBHOOK_SECRET;
    jobs.push(
      fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret
            ? {
                "X-WhiteDog-Signature": createHmac("sha256", secret)
                  .update(body)
                  .digest("hex"),
              }
            : {}),
        },
        body,
      }).then((res) => {
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      }),
    );
  }

  const results = await Promise.allSettled(jobs);
  results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .forEach((r) => console.error("Upgrade request routing failed:", r.reason));
}

export async function notifyRequester({
  to,
  teamName,
  requested,
  approved,
  note,
}: {
  to?: string | null;
  teamName: string;
  requested: string;
  approved: boolean;
  note?: string | null;
}) {
  if (!to) return;
  try {
    await sendEmail({
      to,
      subject: approved
        ? `${teamName} is now on ${requested}`
        : `Update on your ${requested} request`,
      react: UpgradeRequestResolvedEmail({
        teamName,
        requested,
        approved,
        note,
        appUrl: `${appUrl()}/dashboard`,
      }),
      system: true,
    });
  } catch (error) {
    console.error("Failed to notify requester:", error);
  }
}
