"use client";

import { useEffect, useMemo, useState } from "react";

import { useTeam } from "@/context/team-context";
import { ItemType } from "@prisma/client";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

/** itemId -> access for that data room document or folder */
export type ItemPermission = Record<
  string,
  { view: boolean; download: boolean; itemType: ItemType }
>;

type Node = {
  id: string; // DataroomDocument id or DataroomFolder id
  name: string;
  itemType: ItemType;
  children: Node[];
};

type TreeResponseItem = {
  id: string;
  name?: string;
  parentId?: string | null;
  folderId?: string | null;
  document?: { id: string; name: string };
  documents?: { id: string; folderId: string; document: { name: string } }[];
};

function buildTree(items: TreeResponseItem[]): Node[] {
  const folders = items.filter((i) => !i.document);
  const rootDocs = items.filter((i) => i.document);
  const byId = new Map<string, Node>();
  for (const f of folders) {
    byId.set(f.id, {
      id: f.id,
      name: f.name ?? "Folder",
      itemType: ItemType.DATAROOM_FOLDER,
      children: (f.documents ?? []).map((d) => ({
        id: d.id,
        name: d.document.name,
        itemType: ItemType.DATAROOM_DOCUMENT,
        children: [],
      })),
    });
  }
  const roots: Node[] = [];
  for (const f of folders) {
    const node = byId.get(f.id)!;
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent) parent.children.unshift(node);
    else roots.push(node);
  }
  for (const d of rootDocs) {
    roots.push({
      id: d.id,
      name: d.document!.name,
      itemType: ItemType.DATAROOM_DOCUMENT,
      children: [],
    });
  }
  return roots;
}

function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/**
 * Choose which files and folders a data room link can see and download.
 * onSave(null) means "the whole data room".
 */
export function PermissionsSheet({
  isOpen,
  setIsOpen,
  dataroomId,
  linkId,
  permissionGroupId,
  onSave,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dataroomId: string;
  linkId?: string;
  permissionGroupId?: string | null;
  onSave: (permissions: ItemPermission | null) => Promise<void> | void;
}) {
  const teamId = useTeam()?.currentTeam?.id;
  const { data: items } = useSWR<TreeResponseItem[]>(
    isOpen && teamId
      ? `/api/teams/${teamId}/datarooms/${dataroomId}/folders?include_documents=true`
      : null,
    fetcher,
  );
  const { data: existing } = useSWR<{
    permissionGroup: {
      accessControls: {
        itemId: string;
        canView: boolean;
        canDownload: boolean;
      }[];
    };
  }>(
    isOpen && teamId && permissionGroupId
      ? `/api/teams/${teamId}/datarooms/${dataroomId}/permission-groups/${permissionGroupId}`
      : null,
    fetcher,
  );

  const tree = useMemo(() => buildTree(items ?? []), [items]);
  const all = useMemo(() => flatten(tree), [tree]);

  const [restricted, setRestricted] = useState(false);
  const [state, setState] = useState<
    Record<string, { view: boolean; download: boolean }>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const controls = existing?.permissionGroup?.accessControls;
    setRestricted(!!permissionGroupId);
    const next: Record<string, { view: boolean; download: boolean }> = {};
    for (const n of all) {
      const c = controls?.find((x) => x.itemId === n.id);
      next[n.id] = c
        ? { view: c.canView, download: c.canDownload }
        : { view: !permissionGroupId, download: false };
    }
    setState(next);
  }, [isOpen, all, existing, permissionGroupId]);

  const setNode = (node: Node, key: "view" | "download", value: boolean) => {
    setState((prev) => {
      const next = { ...prev };
      for (const n of flatten([node])) {
        const cur = next[n.id] ?? { view: false, download: false };
        next[n.id] =
          key === "view"
            ? { view: value, download: value ? cur.download : false }
            : { view: value ? true : cur.view, download: value };
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!restricted) {
        await onSave(null);
        return;
      }
      const permissions: ItemPermission = {};
      for (const n of all) {
        const s = state[n.id] ?? { view: false, download: false };
        permissions[n.id] = { ...s, itemType: n.itemType };
      }
      await onSave(permissions);
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: Node, depth: number) => {
    const s = state[node.id] ?? { view: false, download: false };
    const isFolder = node.itemType === ItemType.DATAROOM_FOLDER;
    const open = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div
          className="grid grid-cols-[1fr_4rem_5rem] items-center gap-2 py-1.5 text-sm"
          style={{ paddingLeft: depth * 16 }}
        >
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 text-left"
            onClick={() =>
              isFolder &&
              setExpanded((prev) => {
                const next = new Set(prev);
                next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                return next;
              })
            }
          >
            {isFolder ? (
              open ? (
                <ChevronDownIcon className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 shrink-0" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {isFolder ? (
              <FolderIcon className="h-4 w-4 shrink-0" />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          <div className="flex justify-center">
            <Checkbox
              checked={s.view}
              onCheckedChange={(v) => setNode(node, "view", v === true)}
              aria-label={`View ${node.name}`}
            />
          </div>
          <div className="flex justify-center">
            <Checkbox
              checked={s.download}
              onCheckedChange={(v) => setNode(node, "download", v === true)}
              aria-label={`Download ${node.name}`}
            />
          </div>
        </div>
        {isFolder && open
          ? node.children.map((c) => renderNode(c, depth + 1))
          : null}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>File permissions</SheetTitle>
          <SheetDescription>
            Choose what people with this link can see and download.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <span>Share only selected files and folders</span>
          <Switch checked={restricted} onCheckedChange={setRestricted} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!restricted ? (
            <p className="p-2 text-sm text-muted-foreground">
              The link shows the whole data room.
            </p>
          ) : !items ? (
            <p className="p-2 text-sm text-muted-foreground">Loading…</p>
          ) : tree.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              This data room is empty.
            </p>
          ) : (
            <div>
              <div className="grid grid-cols-[1fr_4rem_5rem] gap-2 border-b pb-1 text-xs font-medium text-muted-foreground">
                <span>Name</span>
                <span className="text-center">View</span>
                <span className="text-center">Download</span>
              </div>
              {tree.map((n) => renderNode(n, 0))}
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={saving || !linkId}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
