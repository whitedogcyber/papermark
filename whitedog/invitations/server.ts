import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { CustomUser } from "@/lib/types";
import { constructLinkUrl } from "@/lib/utils/link-url";

import DataroomInvitationEmail from "./email";
import { inviteBodySchema } from "./schema";

type Ctx = { user: CustomUser; teamId: string; dataroomId: string };

async function context(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Ctx | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).end("Unauthorized");
    return null;
  }
  const user = session.user as CustomUser;
  const { teamId, id: dataroomId } = req.query as {
    teamId: string;
    id: string;
  };
  const dataroom = await prisma.dataroom.findFirst({
    where: {
      id: dataroomId,
      teamId,
      team: { users: { some: { userId: user.id } } },
    },
    select: { id: true },
  });
  if (!dataroom) {
    res.status(404).json({ error: "Data room not found" });
    return null;
  }
  return { user, teamId, dataroomId };
}

async function sendInvites({
  ctx,
  link,
  groupId,
  emails,
  message,
}: {
  ctx: Ctx;
  link: {
    id: string;
    domainId: string | null;
    domainSlug: string | null;
    slug: string | null;
    allowList: string[];
    emailProtected: boolean;
  };
  groupId: string | null;
  emails: string[];
  message?: string;
}) {
  const dataroom = await prisma.dataroom.findUniqueOrThrow({
    where: { id: ctx.dataroomId },
    select: { name: true },
  });

  // A link restricted to an allow list must let invited people in.
  if (link.allowList.length > 0) {
    const missing = emails.filter((e) => !link.allowList.includes(e));
    if (missing.length) {
      await prisma.link.update({
        where: { id: link.id },
        data: { allowList: { push: missing } },
      });
    }
  }

  const baseUrl = constructLinkUrl(link);
  const results = { sent: 0, failed: [] as string[] };

  for (const email of emails) {
    const viewer = await prisma.viewer.upsert({
      where: { teamId_email: { teamId: ctx.teamId, email } },
      create: {
        teamId: ctx.teamId,
        email,
        dataroomId: ctx.dataroomId,
        invitedAt: new Date(),
      },
      update: { invitedAt: new Date() },
      select: { id: true },
    });
    if (groupId) {
      await prisma.viewerGroupMembership.upsert({
        where: { viewerId_groupId: { viewerId: viewer.id, groupId } },
        create: { viewerId: viewer.id, groupId },
        update: {},
      });
    }

    const url = link.emailProtected
      ? `${baseUrl}?email=${encodeURIComponent(email)}`
      : baseUrl;

    let status: "SENT" | "FAILED" = "SENT";
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to ${dataroom.name}`,
        react: DataroomInvitationEmail({
          dataroomName: dataroom.name,
          senderEmail: ctx.user.email ?? "A team member",
          url,
          message,
          recipientEmail: email,
        }),
        system: true,
      });
      results.sent++;
    } catch (error) {
      console.error("Invitation email failed:", email, error);
      status = "FAILED";
      results.failed.push(email);
    }

    await prisma.viewerInvitation.create({
      data: {
        viewerId: viewer.id,
        linkId: link.id,
        groupId,
        invitedBy: ctx.user.id,
        customMessage: message ?? null,
        status,
      },
    });
  }
  return results;
}

const LINK_SELECT = {
  id: true,
  groupId: true,
  domainId: true,
  domainSlug: true,
  slug: true,
  allowList: true,
  emailProtected: true,
} as const;

// POST /api/teams/:teamId/datarooms/:id/links/:linkId/invite { emails, message? }
export async function linkInviteHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const ctx = await context(req, res);
  if (!ctx) return;
  const parsed = inviteBodySchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: "Enter valid email addresses" });

  const { linkId } = req.query as { linkId: string };
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      dataroomId: ctx.dataroomId,
      isArchived: false,
      deletedAt: null,
    },
    select: LINK_SELECT,
  });
  if (!link) return res.status(404).json({ error: "Link not found" });

  const result = await sendInvites({
    ctx,
    link,
    groupId: link.groupId,
    emails: parsed.data.emails,
    message: parsed.data.message,
  });
  return res.status(200).json(result);
}

// POST /api/teams/:teamId/datarooms/:id/groups/:groupId/invite { emails, message?, linkId? }
export async function groupInviteHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const ctx = await context(req, res);
  if (!ctx) return;
  const parsed = inviteBodySchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: "Enter valid email addresses" });

  const { groupId } = req.query as { groupId: string };
  const group = await prisma.viewerGroup.findFirst({
    where: { id: groupId, dataroomId: ctx.dataroomId },
    select: { id: true },
  });
  if (!group) return res.status(404).json({ error: "Group not found" });

  const link = await prisma.link.findFirst({
    where: {
      dataroomId: ctx.dataroomId,
      groupId,
      isArchived: false,
      deletedAt: null,
      ...(parsed.data.linkId ? { id: parsed.data.linkId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: LINK_SELECT,
  });
  if (!link) {
    return res
      .status(400)
      .json({ error: "Create a link for this group before inviting people" });
  }

  const result = await sendInvites({
    ctx,
    link,
    groupId,
    emails: parsed.data.emails,
    message: parsed.data.message,
  });
  return res.status(200).json(result);
}

// GET /api/teams/:teamId/datarooms/:id/groups/:groupId/uninvited
export async function uninvitedHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const ctx = await context(req, res);
  if (!ctx) return;
  const { groupId } = req.query as { groupId: string };

  const members = await prisma.viewerGroupMembership.findMany({
    where: {
      groupId,
      group: { dataroomId: ctx.dataroomId },
      viewer: { invitations: { none: { groupId } } },
    },
    select: { viewer: { select: { email: true } } },
  });
  const emails = members.map((m) => m.viewer.email);
  return res.status(200).json({ count: emails.length, emails });
}
