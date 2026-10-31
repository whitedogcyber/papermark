import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { constructLinkUrl } from "@/lib/utils/link-url";

import { TeamQuestionEmail, ViewerReplyEmail } from "./emails";

const base = () => (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");

/** Email the team's admins and managers about a visitor message. */
export async function notifyTeamOfQuestion(opts: {
  teamId: string;
  dataroomId: string;
  conversationId: string;
  viewerEmail: string;
  content: string;
  isNew: boolean;
}) {
  try {
    const [dataroom, managers] = await Promise.all([
      prisma.dataroom.findUnique({
        where: { id: opts.dataroomId },
        select: { name: true },
      }),
      prisma.userTeam.findMany({
        where: {
          teamId: opts.teamId,
          role: { in: ["ADMIN", "MANAGER"] },
          status: "ACTIVE",
        },
        select: { user: { select: { email: true } } },
      }),
    ]);
    const url = `${base()}/datarooms/${opts.dataroomId}/conversations/${opts.conversationId}`;
    await Promise.allSettled(
      managers
        .map((m) => m.user.email)
        .filter((e): e is string => !!e)
        .map((to) =>
          sendEmail({
            to,
            subject: `${opts.isNew ? "New question" : "New reply"} in ${dataroom?.name ?? "your data room"}`,
            react: TeamQuestionEmail({
              viewerEmail: opts.viewerEmail,
              dataroomName: dataroom?.name ?? "your data room",
              content: opts.content.slice(0, 2000),
              isNew: opts.isNew,
              url,
            }),
            system: true,
          }),
        ),
    );
  } catch (error) {
    console.error("Q&A team notification failed:", error);
  }
}

/** Email visitors who asked in this conversation that the team replied. */
export async function notifyViewersOfReply(opts: {
  conversationId: string;
  content: string;
}) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: opts.conversationId },
      select: {
        dataroom: { select: { name: true } },
        link: {
          select: { id: true, domainId: true, domainSlug: true, slug: true },
        },
        participants: {
          where: { viewerId: { not: null }, receiveNotifications: true },
          select: { viewer: { select: { email: true } } },
        },
      },
    });
    if (!conversation?.link) return;
    const url = constructLinkUrl(conversation.link);
    await Promise.allSettled(
      conversation.participants
        .map((p) => p.viewer?.email)
        .filter((e): e is string => !!e)
        .map((to) =>
          sendEmail({
            to,
            subject: `New answer in ${conversation.dataroom.name}`,
            react: ViewerReplyEmail({
              dataroomName: conversation.dataroom.name,
              content: opts.content.slice(0, 2000),
              url,
              recipientEmail: to,
            }),
            system: true,
          }),
        ),
    );
  } catch (error) {
    console.error("Q&A viewer notification failed:", error);
  }
}
