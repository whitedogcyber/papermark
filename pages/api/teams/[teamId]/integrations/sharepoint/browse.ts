import { NextApiRequest, NextApiResponse } from "next";

import { requireSharePointManager } from "@/lib/integrations/sharepoint/api-auth";
import {
  GraphError,
  getItem,
  itemDisplayPath,
  listChildren,
  listDrives,
  resolveSite,
} from "@/lib/integrations/sharepoint/graph";

// GET ?siteUrl=...                -> site and its document libraries
// GET ?driveId=...&itemId=...     -> folders inside a library folder
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }
  const { teamId, siteUrl, driveId, itemId } = req.query as Record<
    string,
    string
  >;
  if (!(await requireSharePointManager(req, res, teamId))) return;

  try {
    if (siteUrl) {
      const site = await resolveSite(siteUrl);
      const drives = await listDrives(site.id);
      return res.status(200).json({
        site: { id: site.id, name: site.displayName, webUrl: site.webUrl },
        drives: drives.map((d) => ({ id: d.id, name: d.name })),
      });
    }

    if (driveId) {
      const id = itemId || "root";
      const [item, children] = await Promise.all([
        getItem(driveId, id),
        listChildren(driveId, id),
      ]);
      return res.status(200).json({
        item: {
          id: item.id,
          name: item.name,
          path: id === "root" ? "/" : itemDisplayPath(item),
          parentId: id === "root" ? null : (item.parentReference?.id ?? null),
        },
        folders: children
          .filter((c) => c.folder && !c.package)
          .map((c) => ({
            id: c.id,
            name: c.name,
            childCount: c.folder?.childCount ?? 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        fileCount: children.filter((c) => c.file).length,
      });
    }

    return res.status(400).json({ error: "siteUrl or driveId is required" });
  } catch (error) {
    const status = (error as GraphError).status;
    const message =
      status === 403 || status === 401
        ? "The WhiteDog Share app has no access to this site. Ask IT to grant it with Sites.Selected."
        : status === 404
          ? "SharePoint site or folder not found."
          : (error as Error).message;
    return res
      .status(status && status < 500 ? status : 502)
      .json({ error: message });
  }
}
