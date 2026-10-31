import { NextApiRequest, NextApiResponse } from "next";

import { effectiveLimits } from "@/whitedog/limits/plan-limits";
import { DocumentStorageType } from "@prisma/client";
import { z } from "zod";

import { processDocument } from "@/lib/api/documents/process-document";
import { verifyDataroomSessionInPagesRouter } from "@/lib/auth/dataroom-auth";
import { SUPPORTED_DOCUMENT_MIME_TYPES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { getSupportedContentType } from "@/lib/utils/get-content-type";

import VisitorUploadEmail from "./email";

const UPLOADS_FOLDER = { name: "Visitor uploads", path: "/visitor-uploads" };

const bodySchema = z.object({
  dataroomId: z.string().min(1),
  folderId: z.string().optional().nullable(),
  documentData: z.object({
    name: z.string().min(1).max(255),
    key: z.string().min(1),
    storageType: z.literal("S3_PATH"),
    contentType: z.string(),
    supportedFileType: z.string().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    numPages: z.number().int().positive().optional(),
  }),
});

/**
 * POST /api/links/:id/upload
 *
 * A data room visitor uploads a file through a link with file requests on.
 * The file goes to the team's "Visitor uploads" folder and the team's admins
 * and managers are emailed. It is not added to the data room until someone
 * on the team does that, so visitors can't publish to each other.
 */
export default async function uploadHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { id: linkId } = req.query as { id: string };
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid upload" });
  const { dataroomId, folderId, documentData } = parsed.data;

  const session = await verifyDataroomSessionInPagesRouter(
    req,
    linkId,
    dataroomId,
  );
  if (!session)
    return res
      .status(401)
      .json({ message: "Your session has expired. Reload the page." });

  const link = await prisma.link.findFirst({
    where: { id: linkId, dataroomId, isArchived: false, deletedAt: null },
    select: {
      teamId: true,
      enableUpload: true,
      uploadFolderId: true,
      team: { select: { plan: true, limits: true } },
      dataroom: { select: { name: true } },
    },
  });
  if (!link?.teamId || !link.enableUpload) {
    return res
      .status(403)
      .json({ message: "Uploads are not enabled for this link" });
  }
  if (!effectiveLimits(link.team?.plan, link.team?.limits).dataroomUpload) {
    return res
      .status(403)
      .json({ message: "Uploads are not available for this data room" });
  }

  // The file must have been uploaded for this team (tus-viewer names it
  // "<teamId>/<docId>/<file>").
  if (
    !documentData.key.startsWith(`${link.teamId}/`) ||
    documentData.key.includes("..")
  ) {
    return res.status(400).json({ message: "Invalid file" });
  }
  if (!SUPPORTED_DOCUMENT_MIME_TYPES.includes(documentData.contentType)) {
    return res.status(400).json({ message: "This file type is not supported" });
  }
  const type = getSupportedContentType(documentData.contentType);
  if (!type)
    return res.status(400).json({ message: "This file type is not supported" });

  const targetFolderId = link.uploadFolderId ?? folderId ?? null;
  const targetFolder = targetFolderId
    ? await prisma.dataroomFolder.findFirst({
        where: { id: targetFolderId, dataroomId },
        select: { name: true },
      })
    : null;

  await prisma.folder.upsert({
    where: { teamId_path: { teamId: link.teamId, path: UPLOADS_FOLDER.path } },
    create: { teamId: link.teamId, ...UPLOADS_FOLDER },
    update: {},
  });

  const document = await processDocument({
    documentData: {
      name: documentData.name,
      key: documentData.key,
      storageType: DocumentStorageType.S3_PATH,
      contentType: documentData.contentType,
      supportedFileType: type,
      fileSize: documentData.fileSize,
      numPages: documentData.numPages,
    },
    teamId: link.teamId,
    teamPlan: link.team?.plan ?? "free",
    folderPathName: UPLOADS_FOLDER.path.slice(1),
    isExternalUpload: true,
  });

  const viewer = session.viewerId
    ? await prisma.viewer.findUnique({
        where: { id: session.viewerId },
        select: { id: true, email: true },
      })
    : null;
  const view = await prisma.view.findUnique({
    where: { id: session.viewId },
    select: { viewerEmail: true },
  });

  await prisma.documentUpload.create({
    data: {
      documentId: document.id,
      teamId: link.teamId,
      linkId,
      viewId: session.viewId,
      viewerId: viewer?.id,
      dataroomId,
      originalFilename: documentData.name,
      fileSize: documentData.fileSize ?? null,
      numPages: documentData.numPages ?? null,
      mimeType: documentData.contentType,
    },
  });

  const managers = await prisma.userTeam.findMany({
    where: {
      teamId: link.teamId,
      role: { in: ["ADMIN", "MANAGER"] },
      status: "ACTIVE",
    },
    select: { user: { select: { email: true } } },
  });
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
  await Promise.allSettled(
    managers
      .map((m) => m.user.email)
      .filter((e): e is string => !!e)
      .map((to) =>
        sendEmail({
          to,
          subject: `New upload in ${link.dataroom?.name ?? "your data room"}`,
          react: VisitorUploadEmail({
            uploaderEmail: viewer?.email ?? view?.viewerEmail ?? "A visitor",
            fileName: documentData.name,
            dataroomName: link.dataroom?.name ?? "your data room",
            folderName: targetFolder?.name,
            reviewUrl: `${base}/documents/${document.id}`,
          }),
          system: true,
        }),
      ),
  );

  return res.status(200).json({ ok: true });
}
