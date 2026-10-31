import { NextApiRequest, NextApiResponse } from "next";

import { effectiveLimits } from "@/whitedog/limits/plan-limits";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";

import { verifyDataroomSessionInPagesRouter } from "@/lib/auth/dataroom-auth";
import prisma from "@/lib/prisma";

import { notifyTeamOfQuestion } from "./notify";

/**
 * Visitor side of data room Q&A.
 *
 *   GET  /api/conversations?linkId&dataroomId            my questions
 *   GET  /api/conversations/faqs?linkId&dataroomId[&documentId]
 *   POST /api/conversations                              ask { linkId, dataroomId, content, documentId?, pageNumber? }
 *   POST /api/conversations/:id/messages                 reply { linkId, dataroomId, content }
 *
 * Visitors are identified by their data room session cookie. Questions are
 * private between the visitor and the team; answers the team publishes as
 * FAQs are shown to everyone on the data room.
 */

const content = z.string().trim().min(1).max(5000);

type Visitor = {
  teamId: string;
  dataroomId: string;
  linkId: string;
  viewId: string;
  viewerId: string;
  viewerEmail: string;
};

async function visitor(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Visitor | null> {
  const src = (req.method === "GET" ? req.query : req.body) ?? {};
  const linkId = typeof src.linkId === "string" ? src.linkId : "";
  const dataroomId = typeof src.dataroomId === "string" ? src.dataroomId : "";
  if (!linkId || !dataroomId) {
    res.status(400).json({ error: "linkId and dataroomId are required" });
    return null;
  }

  const session = await verifyDataroomSessionInPagesRouter(
    req,
    linkId,
    dataroomId,
  );
  if (!session) {
    res
      .status(401)
      .json({ error: "Your session has expired. Reload the page." });
    return null;
  }

  const link = await prisma.link.findFirst({
    where: { id: linkId, dataroomId, isArchived: false, deletedAt: null },
    select: {
      teamId: true,
      enableConversation: true,
      team: { select: { plan: true, limits: true } },
    },
  });
  if (
    !link?.teamId ||
    !link.enableConversation ||
    !effectiveLimits(link.team?.plan, link.team?.limits).conversationsInDataroom
  ) {
    res.status(403).json({ error: "Questions are not enabled for this link" });
    return null;
  }

  const view = await prisma.view.findUnique({
    where: { id: session.viewId },
    select: { viewerId: true, viewerEmail: true },
  });
  const viewerId = session.viewerId ?? view?.viewerId ?? null;
  if (!viewerId) {
    res.status(403).json({ error: "Verify your email to ask questions." });
    return null;
  }
  const viewer = await prisma.viewer.findFirst({
    where: { id: viewerId, teamId: link.teamId },
    select: { email: true },
  });
  if (!viewer) {
    res.status(403).json({ error: "Verify your email to ask questions." });
    return null;
  }

  return {
    teamId: link.teamId,
    dataroomId,
    linkId,
    viewId: session.viewId,
    viewerId,
    viewerEmail: viewer.email,
  };
}

const CONVERSATION_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  lastMessageAt: true,
  documentPageNumber: true,
  dataroomDocument: {
    select: { document: { select: { id: true, name: true } } },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      viewerId: true,
    },
  },
};

function shape(c: any) {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt,
    pageNumber: c.documentPageNumber,
    document: c.dataroomDocument?.document ?? null,
    messages: c.messages.map((m: any) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      fromTeam: !!m.userId,
    })),
  };
}

export default async function viewerConversationsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const segments = ([] as string[]).concat(req.query.conversations ?? []);

  // GET /api/conversations/faqs
  if (req.method === "GET" && segments[0] === "faqs") {
    const v = await visitor(req, res);
    if (!v) return;
    const documentId =
      typeof req.query.documentId === "string"
        ? req.query.documentId
        : undefined;
    const faqs = await prisma.dataroomFaqItem.findMany({
      where: {
        dataroomId: v.dataroomId,
        status: "PUBLISHED",
        OR: [
          { visibilityMode: "PUBLIC_DATAROOM" },
          { visibilityMode: "PUBLIC_LINK", linkId: v.linkId },
          ...(documentId
            ? [
                {
                  visibilityMode: "PUBLIC_DOCUMENT" as const,
                  dataroomDocument: { documentId },
                },
              ]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        editedQuestion: true,
        answer: true,
        documentPageNumber: true,
        dataroomDocument: {
          select: { document: { select: { id: true, name: true } } },
        },
        createdAt: true,
      },
    });
    return res.status(200).json(
      faqs.map((f) => ({
        id: f.id,
        question: f.editedQuestion,
        answer: f.answer,
        title: f.title,
        pageNumber: f.documentPageNumber,
        document: f.dataroomDocument?.document ?? null,
        createdAt: f.createdAt,
      })),
    );
  }

  // GET /api/conversations
  if (req.method === "GET" && segments.length === 0) {
    const v = await visitor(req, res);
    if (!v) return;
    const conversations = await prisma.conversation.findMany({
      where: {
        dataroomId: v.dataroomId,
        participants: { some: { viewerId: v.viewerId } },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      select: CONVERSATION_SELECT,
      take: 100,
    });
    return res.status(200).json(conversations.map(shape));
  }

  // POST /api/conversations
  if (req.method === "POST" && segments.length === 0) {
    const v = await visitor(req, res);
    if (!v) return;
    const body = z
      .object({
        content,
        documentId: z.string().optional(),
        pageNumber: z.number().int().positive().optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success)
      return res.status(400).json({ error: "Enter a question" });

    const dataroomDocument = body.data.documentId
      ? await prisma.dataroomDocument.findFirst({
          where: { dataroomId: v.dataroomId, documentId: body.data.documentId },
          select: { id: true },
        })
      : null;

    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        dataroomId: v.dataroomId,
        teamId: v.teamId,
        linkId: v.linkId,
        initialViewId: v.viewId,
        dataroomDocumentId: dataroomDocument?.id,
        documentPageNumber: dataroomDocument ? body.data.pageNumber : undefined,
        title: body.data.content.slice(0, 80),
        visibilityMode: "PRIVATE",
        lastMessageAt: now,
        participants: {
          create: {
            viewerId: v.viewerId,
            role: "OWNER",
            receiveNotifications: true,
          },
        },
        messages: {
          create: {
            content: body.data.content,
            viewerId: v.viewerId,
            viewId: v.viewId,
          },
        },
        views: { create: { viewId: v.viewId } },
      },
      select: CONVERSATION_SELECT,
    });

    waitUntil(
      notifyTeamOfQuestion({
        teamId: v.teamId,
        dataroomId: v.dataroomId,
        conversationId: conversation.id,
        viewerEmail: v.viewerEmail,
        content: body.data.content,
        isNew: true,
      }),
    );
    return res.status(201).json(shape(conversation));
  }

  // POST /api/conversations/:id/messages
  if (
    req.method === "POST" &&
    segments.length === 2 &&
    segments[1] === "messages"
  ) {
    const v = await visitor(req, res);
    if (!v) return;
    const body = z.object({ content }).safeParse(req.body ?? {});
    if (!body.success)
      return res.status(400).json({ error: "Enter a message" });

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: segments[0],
        dataroomId: v.dataroomId,
        participants: { some: { viewerId: v.viewerId } },
      },
      select: { id: true, isEnabled: true },
    });
    if (!conversation) return res.status(404).json({ error: "Not found" });
    if (!conversation.isEnabled) {
      return res.status(403).json({ error: "This conversation is closed" });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: body.data.content,
        viewerId: v.viewerId,
        viewId: v.viewId,
      },
      select: { id: true, content: true, createdAt: true },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    waitUntil(
      notifyTeamOfQuestion({
        teamId: v.teamId,
        dataroomId: v.dataroomId,
        conversationId: conversation.id,
        viewerEmail: v.viewerEmail,
        content: body.data.content,
        isNew: false,
      }),
    );
    return res.status(201).json({ ...message, fromTeam: false });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
