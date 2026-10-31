import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getLimits } from "@/whitedog/limits/server";
import { getServerSession } from "next-auth/next";

import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { applyTemplateFolders } from "./apply";
import { templateById } from "./catalog";

async function member(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).end("Unauthorized");
    return null;
  }
  const userId = (session.user as CustomUser).id;
  const { teamId } = req.query as { teamId: string };
  const team = await prisma.team.findFirst({
    where: { id: teamId, users: { some: { userId } } },
    select: { id: true },
  });
  if (!team) {
    res.status(401).end("Unauthorized");
    return null;
  }
  return { userId, teamId };
}

// POST /api/teams/:teamId/datarooms/generate  { type }
// Creates a data room named after the template, with its folders.
export async function createFromTemplateHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const ctx = await member(req, res);
  if (!ctx) return;

  const template = templateById((req.body ?? {}).type);
  if (!template) return res.status(400).json({ message: "Unknown template" });

  const [limits, count] = await Promise.all([
    getLimits(ctx),
    prisma.dataroom.count({ where: { teamId: ctx.teamId } }),
  ]);
  if (count >= limits.datarooms) {
    return res.status(403).json({
      message:
        limits.datarooms === 0
          ? "Data rooms are not included in your edition"
          : "You have reached the limit of datarooms",
    });
  }

  const dataroom = await prisma.dataroom.create({
    data: { name: template.name, teamId: ctx.teamId, pId: newId("dataroom") },
  });
  await applyTemplateFolders(dataroom.id, template.folders);

  return res
    .status(201)
    .json({ dataroom: { ...dataroom, _count: { documents: 0 } } });
}

// POST /api/teams/:teamId/datarooms/:id/apply-template  { templateId }
export async function applyTemplateHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  const ctx = await member(req, res);
  if (!ctx) return;
  const { id: dataroomId } = req.query as { id: string };
  const dataroom = await prisma.dataroom.findFirst({
    where: { id: dataroomId, teamId: ctx.teamId },
    select: { id: true },
  });
  if (!dataroom)
    return res.status(404).json({ message: "Data room not found" });

  const body = req.body ?? {};
  const template = templateById(body.templateId ?? body.type);
  if (!template) return res.status(400).json({ message: "Unknown template" });

  await applyTemplateFolders(dataroom.id, template.folders);
  return res.status(200).json({ ok: true });
}
