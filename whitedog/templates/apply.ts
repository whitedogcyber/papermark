import slugify from "@sindresorhus/slugify";

import prisma from "@/lib/prisma";

import { TemplateFolder } from "./catalog";

/**
 * Creates the template's folders in a data room. Existing folders with the
 * same path are reused, so applying a template twice is harmless.
 */
export async function applyTemplateFolders(
  dataroomId: string,
  folders: TemplateFolder[],
) {
  const create = async (
    items: TemplateFolder[],
    parent: { id: string | null; path: string },
  ) => {
    for (const [index, item] of items.entries()) {
      const path = `${parent.path === "/" ? "" : parent.path}/${slugify(item.name)}`;
      const folder = await prisma.dataroomFolder.upsert({
        where: { dataroomId_path: { dataroomId, path } },
        create: {
          dataroomId,
          name: item.name,
          path,
          parentId: parent.id,
          orderIndex: index,
        },
        update: {},
        select: { id: true, path: true },
      });
      if (item.children?.length) await create(item.children, folder);
    }
  };
  await create(folders, { id: null, path: "/" });
}
