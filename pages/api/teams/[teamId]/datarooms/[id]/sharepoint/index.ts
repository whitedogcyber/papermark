import { NextApiRequest, NextApiResponse } from "next";

import { requireSharePointManager } from "@/lib/integrations/sharepoint/api-auth";
import {
  GraphError,
  getItem,
  itemDisplayPath,
  listDrives,
} from "@/lib/integrations/sharepoint/graph";
import { ensureSubscription } from "@/lib/integrations/sharepoint/subscriptions";
import { kickSync } from "@/lib/integrations/sharepoint/sync";
import prisma from "@/lib/prisma";

const SYNC_SELECT = {
  id: true,
  siteName: true,
  siteUrl: true,
  driveName: true,
  rootPath: true,
  status: true,
  lastError: true,
  lastSyncedAt: true,
  dataroomFolderId: true,
  dataroomFolder: { select: { name: true, path: true } },
  _count: { select: { items: true } },
} as const;

// GET  /api/teams/:teamId/datarooms/:id/sharepoint -> linked folders
// POST /api/teams/:teamId/datarooms/:id/sharepoint -> link a SharePoint folder
//      body: { siteId, siteName, siteUrl, driveId, itemId, folderPath? }
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { teamId, id: dataroomId } = req.query as {
    teamId: string;
    id: string;
  };
  const userId = await requireSharePointManager(req, res, teamId);
  if (!userId) return;

  const dataroom = await prisma.dataroom.findFirst({
    where: { id: dataroomId, teamId },
    select: { id: true },
  });
  if (!dataroom) return res.status(404).json({ error: "Data room not found" });

  if (req.method === "GET") {
    const syncs = await prisma.sharePointSync.findMany({
      where: { dataroomId },
      select: SYNC_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return res.status(200).json(syncs);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  }

  const { siteId, siteName, siteUrl, driveId, itemId, folderPath } =
    req.body as {
      siteId?: string;
      siteName?: string;
      siteUrl?: string;
      driveId?: string;
      itemId?: string;
      folderPath?: string; // data room folder path, "/" or empty for the root
    };
  if (!siteId || !driveId || !itemId) {
    return res
      .status(400)
      .json({ error: "siteId, driveId and itemId are required" });
  }

  // Target data room folder.
  const targetPath =
    !folderPath || folderPath === "/"
      ? "/"
      : "/" + folderPath.replace(/^\/+/, "");
  const folder =
    targetPath === "/"
      ? null
      : await prisma.dataroomFolder.findUnique({
          where: { dataroomId_path: { dataroomId, path: targetPath } },
          select: { id: true, path: true },
        });
  if (targetPath !== "/" && !folder) {
    return res.status(404).json({ error: "Data room folder not found" });
  }

  // A folder can only be managed by one sync: no overlapping links.
  const existing = await prisma.sharePointSync.findMany({
    where: { dataroomId },
    select: { dataroomFolder: { select: { path: true } } },
  });
  const overlaps = existing.some(({ dataroomFolder }) => {
    const p = dataroomFolder?.path ?? "/";
    return (
      p === "/" ||
      targetPath === "/" ||
      p === targetPath ||
      targetPath.startsWith(p + "/") ||
      p.startsWith(targetPath + "/")
    );
  });
  if (overlaps) {
    return res.status(409).json({
      error:
        "This folder, a parent or a subfolder is already synced with SharePoint.",
    });
  }

  try {
    const [item, drives] = await Promise.all([
      getItem(driveId, itemId),
      listDrives(siteId),
    ]);
    const drive = drives.find((d) => d.id === driveId);
    if (!drive)
      return res.status(400).json({ error: "Library not found on this site" });
    if (!item.folder)
      return res.status(400).json({ error: "Pick a folder, not a file" });

    const sync = await prisma.sharePointSync.create({
      data: {
        teamId,
        dataroomId,
        dataroomFolderId: folder?.id ?? null,
        siteId,
        siteName: siteName || "SharePoint",
        siteUrl: siteUrl || "",
        driveId,
        driveName: drive.name,
        rootItemId: item.id,
        rootPath: itemId === "root" ? "/" : itemDisplayPath(item),
        createdById: userId,
      },
      select: SYNC_SELECT,
    });

    await ensureSubscription(driveId);
    kickSync(sync.id);
    return res.status(201).json(sync);
  } catch (error) {
    const status = (error as GraphError).status;
    return res
      .status(status && status < 500 ? status : 502)
      .json({ error: (error as Error).message });
  }
}
