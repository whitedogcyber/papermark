import slugify from "@sindresorhus/slugify";

import prisma from "@/lib/prisma";

import {
  createDocumentFromItem,
  createVersionFromItem,
  maxFileBytes,
  resolveContentType,
} from "./documents";
import { GraphDriveItem, getItem, listChildren } from "./graph";

/**
 * One-way sync: SharePoint folder -> data room folder.
 *
 * Each run walks the linked SharePoint folder and reconciles it with what the
 * previous run recorded:
 *  - new files become Papermark documents in the data room
 *  - changed files (new cTag) become a new version of the same document,
 *    so links and analytics stay intact
 *  - renamed or moved files and folders are renamed or moved
 *  - files removed from SharePoint are removed from the data room; the
 *    Papermark document and its view history are kept
 *
 * If SharePoint can't be listed completely the run stops before changing
 * anything, so an outage or a revoked permission never empties a data room.
 */

const LOCK_MS = 30 * 60_000;
const MAX_PASSES = 3;

type RemoteItem = {
  item: GraphDriveItem;
  parentId: string;
  kind: "file" | "folder";
  depth: number;
};

type FolderRef = { id: string | null; path: string };

export async function runSync(syncId: string): Promise<void> {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const now = new Date();
    const locked = await prisma.sharePointSync.updateMany({
      where: {
        id: syncId,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      data: {
        lockedUntil: new Date(now.getTime() + LOCK_MS),
        status: "syncing",
        needsSync: false,
      },
    });
    // Another run holds the lock; it will see needsSync and go again.
    if (locked.count === 0) return;

    let status = "ok";
    let message: string | null = null;
    try {
      message = await syncOnce(syncId);
    } catch (error) {
      status = "error";
      message = (error as Error).message?.slice(0, 1000) || "Sync failed";
      console.error(`SharePoint sync ${syncId} failed:`, error);
    }

    const done = await prisma.sharePointSync
      .update({
        where: { id: syncId },
        data: {
          status,
          lastError: message,
          lockedUntil: null,
          ...(status === "ok" ? { lastSyncedAt: new Date() } : {}),
        },
        select: { needsSync: true },
      })
      .catch(() => null); // sync was unlinked mid-run

    if (!done?.needsSync || status === "error") return;
  }
}

/** Fire and forget; errors are recorded on the sync row. */
export function kickSync(syncId: string): void {
  runSync(syncId).catch((error) =>
    console.error(`SharePoint sync ${syncId} crashed:`, error),
  );
}

async function walk(
  driveId: string,
  rootItemId: string,
): Promise<Map<string, RemoteItem>> {
  const root = await getItem(driveId, rootItemId);
  if (!root.folder)
    throw new Error("The linked SharePoint item is not a folder");

  const remote = new Map<string, RemoteItem>();
  const queue: { id: string; depth: number }[] = [{ id: rootItemId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    for (const child of await listChildren(driveId, id)) {
      if (child.package) continue; // OneNote notebooks and similar
      if (child.folder) {
        remote.set(child.id, {
          item: child,
          parentId: id,
          kind: "folder",
          depth: depth + 1,
        });
        queue.push({ id: child.id, depth: depth + 1 });
      } else if (child.file) {
        remote.set(child.id, {
          item: child,
          parentId: id,
          kind: "file",
          depth: depth + 1,
        });
      }
    }
  }
  return remote;
}

function childPath(parentPath: string, segment: string) {
  return `${parentPath === "/" ? "" : parentPath}/${segment}`;
}

async function uniqueFolderPath(
  dataroomId: string,
  parentPath: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || "folder";
  for (let n = 0; n < 100; n++) {
    const candidate = childPath(parentPath, n === 0 ? base : `${base}-${n}`);
    const existing = await prisma.dataroomFolder.findUnique({
      where: { dataroomId_path: { dataroomId, path: candidate } },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
  }
  throw new Error(`Too many folders named "${name}"`);
}

async function moveFolder(
  dataroomId: string,
  folderId: string,
  oldPath: string,
  data: { name: string; parentId: string | null; path: string },
) {
  await prisma.$transaction(async (tx) => {
    await tx.dataroomFolder.update({ where: { id: folderId }, data });
    if (data.path === oldPath) return;
    const descendants = await tx.dataroomFolder.findMany({
      where: { dataroomId, path: { startsWith: oldPath + "/" } },
      select: { id: true, path: true },
    });
    for (const d of descendants) {
      await tx.dataroomFolder.update({
        where: { id: d.id },
        data: { path: data.path + d.path.slice(oldPath.length) },
      });
    }
  });
}

async function syncOnce(syncId: string): Promise<string | null> {
  const sync = await prisma.sharePointSync.findUniqueOrThrow({
    where: { id: syncId },
    include: {
      team: { select: { plan: true } },
      dataroomFolder: { select: { id: true, path: true } },
    },
  });
  const { dataroomId, driveId, teamId } = sync;

  // 1. Read SharePoint completely before touching anything.
  const remote = await walk(driveId, sync.rootItemId);

  const records = await prisma.sharePointSyncItem.findMany({
    where: { syncId },
  });
  const byItem = new Map(records.map((r) => [r.driveItemId, r]));

  const folders = new Map<string, FolderRef>();
  folders.set(sync.rootItemId, {
    id: sync.dataroomFolderId,
    path: sync.dataroomFolder?.path ?? "/",
  });

  const skipped: string[] = [];
  const failed: string[] = [];

  // 2. Folders, parents first.
  const remoteFolders = [...remote.values()]
    .filter((r) => r.kind === "folder")
    .sort((a, b) => a.depth - b.depth);

  for (const { item, parentId } of remoteFolders) {
    const parent = folders.get(parentId);
    if (!parent) continue;
    const record = byItem.get(item.id);

    let folder = record?.dataroomFolderId
      ? await prisma.dataroomFolder.findFirst({
          where: { id: record.dataroomFolderId, dataroomId },
          select: { id: true, name: true, path: true, parentId: true },
        })
      : null;

    if (!folder) {
      const path = await uniqueFolderPath(dataroomId, parent.path, item.name);
      folder = await prisma.dataroomFolder.create({
        data: { dataroomId, name: item.name, path, parentId: parent.id },
        select: { id: true, name: true, path: true, parentId: true },
      });
    } else if (folder.name !== item.name || folder.parentId !== parent.id) {
      const path = await uniqueFolderPath(
        dataroomId,
        parent.path,
        item.name,
        folder.id,
      );
      await moveFolder(dataroomId, folder.id, folder.path, {
        name: item.name,
        parentId: parent.id,
        path,
      });
      folder = { ...folder, name: item.name, parentId: parent.id, path };
    }

    folders.set(item.id, { id: folder.id, path: folder.path });
    await prisma.sharePointSyncItem.upsert({
      where: { syncId_driveItemId: { syncId, driveItemId: item.id } },
      create: {
        syncId,
        driveItemId: item.id,
        parentDriveItemId: parentId,
        kind: "folder",
        name: item.name,
        dataroomFolderId: folder.id,
      },
      update: {
        parentDriveItemId: parentId,
        name: item.name,
        dataroomFolderId: folder.id,
      },
    });
  }

  // 3. Files.
  const maxBytes = maxFileBytes();
  for (const { item, parentId, kind } of remote.values()) {
    if (kind !== "file") continue;
    const parent = folders.get(parentId);
    if (!parent) continue;

    const contentType = resolveContentType(item);
    if (!contentType || (item.size ?? 0) > maxBytes) {
      skipped.push(item.name);
      continue;
    }

    try {
      const record = byItem.get(item.id);
      let document = record?.documentId
        ? await prisma.document.findFirst({
            where: { id: record.documentId, teamId },
            select: { id: true, name: true },
          })
        : null;
      let cTag = record?.cTag ?? null;

      if (!document) {
        const id = await createDocumentFromItem({
          teamId,
          teamPlan: sync.team.plan,
          userId: sync.createdById ?? undefined,
          driveId,
          item,
          contentType,
        });
        document = { id, name: item.name };
        cTag = item.cTag ?? null;
      } else if (item.cTag && item.cTag !== record?.cTag) {
        await createVersionFromItem({
          teamId,
          teamPlan: sync.team.plan,
          documentId: document.id,
          driveId,
          item,
          contentType,
        });
        cTag = item.cTag;
      }

      if (document.name !== item.name) {
        await prisma.document.update({
          where: { id: document.id },
          data: { name: item.name },
        });
      }

      let dataroomDocument = record?.dataroomDocumentId
        ? await prisma.dataroomDocument.findFirst({
            where: { id: record.dataroomDocumentId, dataroomId },
            select: { id: true, folderId: true },
          })
        : null;
      if (!dataroomDocument) {
        dataroomDocument = await prisma.dataroomDocument.create({
          data: { dataroomId, documentId: document.id, folderId: parent.id },
          select: { id: true, folderId: true },
        });
      } else if (dataroomDocument.folderId !== parent.id) {
        await prisma.dataroomDocument.update({
          where: { id: dataroomDocument.id },
          data: { folderId: parent.id },
        });
      }

      await prisma.sharePointSyncItem.upsert({
        where: { syncId_driveItemId: { syncId, driveItemId: item.id } },
        create: {
          syncId,
          driveItemId: item.id,
          parentDriveItemId: parentId,
          kind: "file",
          name: item.name,
          cTag,
          documentId: document.id,
          dataroomDocumentId: dataroomDocument.id,
        },
        update: {
          parentDriveItemId: parentId,
          name: item.name,
          cTag,
          documentId: document.id,
          dataroomDocumentId: dataroomDocument.id,
        },
      });
    } catch (error) {
      // One bad file shouldn't stop the rest. It is retried next run because
      // its cTag was not recorded.
      console.error(`SharePoint sync ${syncId}: ${item.name} failed`, error);
      failed.push(item.name);
    }
  }

  // 4. Removed from SharePoint: take files out of the data room, keep the
  // documents. Then drop folders that are now empty, deepest first.
  const gone = records.filter((r) => !remote.has(r.driveItemId));
  for (const r of gone.filter((g) => g.kind === "file")) {
    if (r.dataroomDocumentId) {
      await prisma.dataroomDocument.deleteMany({
        where: { id: r.dataroomDocumentId, dataroomId },
      });
    }
    await prisma.sharePointSyncItem.delete({ where: { id: r.id } });
  }

  const goneFolders = await prisma.dataroomFolder.findMany({
    where: {
      dataroomId,
      id: {
        in: gone
          .filter((g) => g.kind === "folder" && g.dataroomFolderId)
          .map((g) => g.dataroomFolderId!),
      },
    },
    select: { id: true, path: true },
  });
  goneFolders.sort((a, b) => b.path.length - a.path.length);
  for (const f of goneFolders) {
    const [docs, children] = await Promise.all([
      prisma.dataroomDocument.count({ where: { folderId: f.id } }),
      prisma.dataroomFolder.count({ where: { parentId: f.id } }),
    ]);
    // Keep folders that still hold things added by hand in Papermark.
    if (docs === 0 && children === 0) {
      await prisma.dataroomFolder.delete({ where: { id: f.id } });
    }
  }
  await prisma.sharePointSyncItem.deleteMany({
    where: {
      syncId,
      id: { in: gone.filter((g) => g.kind === "folder").map((g) => g.id) },
    },
  });

  const notes: string[] = [];
  if (failed.length) notes.push(`Failed, will retry: ${list(failed)}`);
  if (skipped.length)
    notes.push(`Skipped (unsupported or too large): ${list(skipped)}`);
  return notes.length ? notes.join(". ") : null;
}

function list(names: string[]) {
  const shown = names.slice(0, 5).join(", ");
  return names.length > 5 ? `${shown} and ${names.length - 5} more` : shown;
}
