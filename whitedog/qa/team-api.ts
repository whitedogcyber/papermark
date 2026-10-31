import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { notifyViewersOfReply } from "./notify";

type Ctx = { userId: string; teamId: string; dataroomId: string };

async function teamContext(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Ctx | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).end("Unauthorized");
    return null;
  }
  const userId = (session.user as CustomUser).id;
  const { teamId, id: dataroomId } = req.query as {
    teamId: string;
    id: string;
  };
  const dataroom = await prisma.dataroom.findFirst({
    where: { id: dataroomId, teamId, team: { users: { some: { userId } } } },
    select: { id: true },
  });
  if (!dataroom) {
    res.status(404).json({ error: "Data room not found" });
    return null;
  }
  return { userId, teamId, dataroomId };
}

/**
 * Team side of data room Q&A.
 *
 *   GET    .../conversations                 list
 *   GET    .../conversations/:id             thread (marks visitor messages read)
 *   POST   .../conversations/:id/messages    reply { content }
 *   PATCH  .../conversations/:id             { isEnabled } open or close
 *   DELETE .../conversations/:id
 */
export async function teamConversationsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const ctx = await teamContext(req, res);
  if (!ctx) return;
  const segments = ([] as string[]).concat(req.query.conversations ?? []);
  const [conversationId, sub] = segments;

  if (!conversationId && req.method === "GET") {
    const conversations = await prisma.conversation.findMany({
      where: { dataroomId: ctx.dataroomId },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        title: true,
        isEnabled: true,
        createdAt: true,
        lastMessageAt: true,
        documentPageNumber: true,
        link: { select: { id: true, name: true } },
        dataroomDocument: {
          select: { document: { select: { id: true, name: true } } },
        },
        participants: {
          where: { viewerId: { not: null } },
          select: { viewer: { select: { email: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, userId: true, createdAt: true },
        },
        _count: {
          select: {
            messages: { where: { isRead: false, viewerId: { not: null } } },
          },
        },
      },
    });
    return res.status(200).json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title,
        isEnabled: c.isEnabled,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        pageNumber: c.documentPageNumber,
        link: c.link,
        document: c.dataroomDocument?.document ?? null,
        viewerEmails: c.participants
          .map((p) => p.viewer?.email)
          .filter(Boolean),
        lastMessage: c.messages[0]
          ? { ...c.messages[0], fromTeam: !!c.messages[0].userId }
          : null,
        unread: c._count.messages,
      })),
    );
  }

  if (!conversationId) {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, dataroomId: ctx.dataroomId },
    select: { id: true },
  });
  if (!conversation) return res.status(404).json({ error: "Not found" });

  if (!sub && req.method === "GET") {
    await prisma.message.updateMany({
      where: { conversationId, viewerId: { not: null }, isRead: false },
      data: { isRead: true },
    });
    const c = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: {
        id: true,
        title: true,
        isEnabled: true,
        createdAt: true,
        documentPageNumber: true,
        link: { select: { id: true, name: true } },
        dataroomDocument: {
          select: { id: true, document: { select: { id: true, name: true } } },
        },
        participants: {
          select: {
            viewer: { select: { email: true } },
            user: { select: { name: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
            viewer: { select: { email: true } },
          },
        },
        faqItems: { select: { id: true } },
      },
    });
    return res.status(200).json({
      id: c.id,
      title: c.title,
      isEnabled: c.isEnabled,
      createdAt: c.createdAt,
      pageNumber: c.documentPageNumber,
      link: c.link,
      dataroomDocumentId: c.dataroomDocument?.id ?? null,
      document: c.dataroomDocument?.document ?? null,
      viewerEmails: c.participants.map((p) => p.viewer?.email).filter(Boolean),
      faqIds: c.faqItems.map((f) => f.id),
      messages: c.messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        fromTeam: !!m.user,
        author: m.user?.name || m.user?.email || m.viewer?.email || "Visitor",
      })),
    });
  }

  if (sub === "messages" && req.method === "POST") {
    const body = z
      .object({ content: z.string().trim().min(1).max(5000) })
      .safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: "Enter a reply" });

    const message = await prisma.message.create({
      data: { conversationId, content: body.data.content, userId: ctx.userId },
      select: { id: true, content: true, createdAt: true },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId: ctx.userId } },
      create: { conversationId, userId: ctx.userId },
      update: {},
    });
    waitUntil(
      notifyViewersOfReply({ conversationId, content: body.data.content }),
    );
    return res.status(201).json({ ...message, fromTeam: true });
  }

  if (!sub && req.method === "PATCH") {
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: "Invalid input" });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { isEnabled: body.data.isEnabled },
    });
    return res.status(200).json({ ok: true });
  }

  if (!sub && req.method === "DELETE") {
    await prisma.conversation.delete({ where: { id: conversationId } });
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
  return res.status(405).end();
}

const faqSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  editedQuestion: z.string().trim().min(1).max(5000),
  answer: z.string().trim().min(1).max(10000),
  visibilityMode: z
    .enum(["PUBLIC_DATAROOM", "PUBLIC_LINK", "PUBLIC_DOCUMENT"])
    .default("PUBLIC_DATAROOM"),
  linkId: z.string().optional().nullable(),
  dataroomDocumentId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
  sourceConversationId: z.string().optional().nullable(),
  questionMessageId: z.string().optional().nullable(),
  answerMessageId: z.string().optional().nullable(),
  originalQuestion: z.string().optional().nullable(),
});

/**
 *   GET    .../faqs           list
 *   POST   .../faqs           create
 *   PUT    .../faqs/:faqId    update
 *   DELETE .../faqs/:faqId
 */
export async function teamFaqsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const ctx = await teamContext(req, res);
  if (!ctx) return;
  const { faqId } = req.query as { faqId?: string };

  if (!faqId && req.method === "GET") {
    const faqs = await prisma.dataroomFaqItem.findMany({
      where: { dataroomId: ctx.dataroomId },
      orderBy: { createdAt: "desc" },
      include: {
        link: { select: { id: true, name: true } },
        dataroomDocument: { select: { document: { select: { name: true } } } },
        publishedByUser: { select: { name: true, email: true } },
      },
    });
    return res.status(200).json(faqs);
  }

  const parse = () => faqSchema.safeParse(req.body ?? {});

  const checkRefs = async (d: z.infer<typeof faqSchema>) => {
    if (d.visibilityMode === "PUBLIC_LINK") {
      if (!d.linkId) return "Choose a link";
      const ok = await prisma.link.count({
        where: { id: d.linkId, dataroomId: ctx.dataroomId },
      });
      if (!ok) return "Link not found";
    }
    if (d.visibilityMode === "PUBLIC_DOCUMENT") {
      if (!d.dataroomDocumentId) return "Choose a document";
      const ok = await prisma.dataroomDocument.count({
        where: { id: d.dataroomDocumentId, dataroomId: ctx.dataroomId },
      });
      if (!ok) return "Document not found";
    }
    if (d.sourceConversationId) {
      const ok = await prisma.conversation.count({
        where: { id: d.sourceConversationId, dataroomId: ctx.dataroomId },
      });
      if (!ok) return "Conversation not found";
    }
    return null;
  };

  if (!faqId && req.method === "POST") {
    const p = parse();
    if (!p.success)
      return res.status(400).json({ error: "Enter a question and an answer" });
    const err = await checkRefs(p.data);
    if (err) return res.status(400).json({ error: err });
    const faq = await prisma.dataroomFaqItem.create({
      data: {
        ...p.data,
        linkId: p.data.visibilityMode === "PUBLIC_LINK" ? p.data.linkId : null,
        dataroomDocumentId:
          p.data.visibilityMode === "PUBLIC_DOCUMENT"
            ? p.data.dataroomDocumentId
            : null,
        dataroomId: ctx.dataroomId,
        teamId: ctx.teamId,
        publishedByUserId: ctx.userId,
      },
    });
    return res.status(201).json(faq);
  }

  if (faqId) {
    const existing = await prisma.dataroomFaqItem.findFirst({
      where: { id: faqId, dataroomId: ctx.dataroomId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "FAQ not found" });

    if (req.method === "PUT" || req.method === "PATCH") {
      const p = parse();
      if (!p.success)
        return res
          .status(400)
          .json({ error: "Enter a question and an answer" });
      const err = await checkRefs(p.data);
      if (err) return res.status(400).json({ error: err });
      const faq = await prisma.dataroomFaqItem.update({
        where: { id: faqId },
        data: {
          title: p.data.title,
          editedQuestion: p.data.editedQuestion,
          answer: p.data.answer,
          visibilityMode: p.data.visibilityMode,
          status: p.data.status,
          linkId:
            p.data.visibilityMode === "PUBLIC_LINK" ? p.data.linkId : null,
          dataroomDocumentId:
            p.data.visibilityMode === "PUBLIC_DOCUMENT"
              ? p.data.dataroomDocumentId
              : null,
        },
      });
      return res.status(200).json(faq);
    }
    if (req.method === "DELETE") {
      await prisma.dataroomFaqItem.delete({ where: { id: faqId } });
      return res.status(204).end();
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).end();
}
