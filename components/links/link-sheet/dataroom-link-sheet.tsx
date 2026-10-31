"use client";

import LinkSheet from "./index";

export type { ItemPermission } from "@/whitedog/permissions/permissions-sheet";

/**
 * Data room links use the standard link sheet. File-level access is set
 * afterwards with "File permissions" in the links table.
 */
export function DataroomLinkSheet(
  props: React.ComponentProps<typeof LinkSheet>,
) {
  return <LinkSheet {...props} />;
}
