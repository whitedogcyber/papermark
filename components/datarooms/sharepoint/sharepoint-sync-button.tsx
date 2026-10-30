import { useEffect, useRef, useState } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LibraryIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { SHAREPOINT_ENABLED } from "@/lib/integrations/sharepoint/enabled";
import { fetcher, timeAgo } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResponsiveButton } from "@/components/ui/responsive-button";

type Sync = {
  id: string;
  siteName: string;
  siteUrl: string;
  driveName: string;
  rootPath: string;
  status: "pending" | "syncing" | "ok" | "error";
  lastError: string | null;
  lastSyncedAt: string | null;
  dataroomFolderId: string | null;
  dataroomFolder: { name: string; path: string } | null;
  _count: { items: number };
};

type Site = { id: string; name: string; webUrl: string };
type Drive = { id: string; name: string };
type Browse = {
  item: { id: string; name: string; path: string; parentId: string | null };
  folders: { id: string; name: string; childCount: number }[];
  fileCount: number;
};

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

/**
 * Data room toolbar button: shows SharePoint folders linked to this data
 * room and links the current data room folder to a SharePoint folder.
 */
export function SharePointSyncButton({
  teamId,
  dataroomId,
  folderPath = "/",
  folderName,
}: {
  teamId?: string;
  dataroomId?: string;
  /** current data room folder path, "/" for the root */
  folderPath?: string;
  folderName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!SHAREPOINT_ENABLED || !teamId || !dataroomId) return null;

  return (
    <>
      <ResponsiveButton
        icon={<LibraryIcon className="h-4 w-4 shrink-0" />}
        text="SharePoint"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          {open ? (
            <SharePointSyncPanel
              teamId={teamId}
              dataroomId={dataroomId}
              folderPath={folderPath}
              folderName={folderName}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SharePointSyncPanel({
  teamId,
  dataroomId,
  folderPath,
  folderName,
}: {
  teamId: string;
  dataroomId: string;
  folderPath: string;
  folderName?: string;
}) {
  const base = `/api/teams/${teamId}/datarooms/${dataroomId}/sharepoint`;
  const { mutate: globalMutate } = useSWRConfig();
  const [linking, setLinking] = useState(false);

  const {
    data: syncs,
    error: loadError,
    mutate,
  } = useSWR<Sync[]>(base, fetcher, {
    refreshInterval: (latest) =>
      latest?.some((s) => s.status === "pending" || s.status === "syncing")
        ? 3000
        : 0,
  });

  // Refresh the data room listing when a sync finishes.
  const busy = syncs?.some(
    (s) => s.status === "pending" || s.status === "syncing",
  );
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      globalMutate(
        (key) =>
          typeof key === "string" &&
          key.startsWith(`/api/teams/${teamId}/datarooms/${dataroomId}`),
      );
    }
    wasBusy.current = Boolean(busy);
  }, [busy, globalMutate, teamId, dataroomId]);

  const target =
    folderPath === "/" ? "the data room root" : `"${folderName || folderPath}"`;
  const covered = syncs?.some((s) => {
    const p = s.dataroomFolder?.path ?? "/";
    return (
      p === "/" ||
      folderPath === "/" ||
      p === folderPath ||
      folderPath.startsWith(p + "/") ||
      p.startsWith(folderPath + "/")
    );
  });

  const syncNow = async (id: string) => {
    try {
      await api(`${base}/${id}`, { method: "POST" });
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const unlink = async (id: string) => {
    if (
      !window.confirm(
        "Stop syncing this folder? Documents already in the data room stay.",
      )
    ) {
      return;
    }
    try {
      await api(`${base}/${id}`, { method: "DELETE" });
      await mutate();
      toast.success("SharePoint folder unlinked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (linking) {
    return (
      <LinkFlow
        teamId={teamId}
        target={target}
        onCancel={() => setLinking(false)}
        onPick={async (pick) => {
          try {
            await api(base, {
              method: "POST",
              body: JSON.stringify({ ...pick, folderPath }),
            });
            toast.success("Linked. The first sync is running.");
            setLinking(false);
            await mutate();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>SharePoint sync</DialogTitle>
        <DialogDescription>
          Linked folders stay current with SharePoint. Changed files become new
          versions; files removed in SharePoint are removed from the data room.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {loadError ? (
          <p className="text-sm text-destructive">
            Only team admins and managers can manage SharePoint sync.
          </p>
        ) : !syncs ? (
          <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : syncs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No SharePoint folders linked yet.
          </p>
        ) : (
          syncs.map((s) => (
            <div key={s.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {s.siteName} / {s.driveName}
                    {s.rootPath === "/" ? "" : s.rootPath}
                  </div>
                  <div className="truncate text-muted-foreground">
                    Into{" "}
                    {s.dataroomFolder
                      ? s.dataroomFolder.name
                      : "data room root"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Sync now"
                    disabled={s.status === "syncing"}
                    onClick={() => syncNow(s.id)}
                  >
                    <RefreshCwIcon
                      className={`h-4 w-4 ${s.status === "syncing" || s.status === "pending" ? "animate-spin" : ""}`}
                    />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Unlink"
                    onClick={() => unlink(s.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.status === "syncing" || s.status === "pending"
                  ? "Syncing..."
                  : s.status === "error"
                    ? "Last sync failed"
                    : s.lastSyncedAt
                      ? `Synced ${timeAgo(s.lastSyncedAt)}`
                      : ""}
              </div>
              {s.lastError ? (
                <div
                  className={`mt-1 text-xs ${s.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {s.lastError}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!syncs || covered}
          title={
            covered
              ? "This folder is already covered by a SharePoint link"
              : undefined
          }
          onClick={() => setLinking(true)}
        >
          Link a SharePoint folder to {target}
        </Button>
      </div>
    </>
  );
}

type Pick = {
  siteId: string;
  siteName: string;
  siteUrl: string;
  driveId: string;
  itemId: string;
};

function LinkFlow({
  teamId,
  target,
  onCancel,
  onPick,
}: {
  teamId: string;
  target: string;
  onCancel: () => void;
  onPick: (pick: Pick) => Promise<void>;
}) {
  const browseUrl = `/api/teams/${teamId}/integrations/sharepoint/browse`;
  const [siteUrl, setSiteUrl] = useState("");
  const [site, setSite] = useState<Site | null>(null);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [drive, setDrive] = useState<Drive | null>(null);
  const [view, setView] = useState<Browse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const findSite = () =>
    run(async () => {
      const data = await api(
        `${browseUrl}?siteUrl=${encodeURIComponent(siteUrl)}`,
      );
      setSite(data.site);
      setDrives(data.drives);
      setDrive(null);
      setView(null);
    });

  const openFolder = (d: Drive, itemId = "root") =>
    run(async () => {
      const data = await api(
        `${browseUrl}?driveId=${encodeURIComponent(d.id)}&itemId=${encodeURIComponent(itemId)}`,
      );
      setDrive(d);
      setView(data);
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link a SharePoint folder</DialogTitle>
        <DialogDescription>
          Its contents will sync into {target}.
        </DialogDescription>
      </DialogHeader>

      {!site ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (siteUrl) findSite();
          }}
        >
          <Input
            autoFocus
            placeholder="https://whitedog.sharepoint.com/sites/Deals"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!siteUrl || loading}>
            Find site
          </Button>
        </form>
      ) : !drive || !view ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {site.name}: choose a library
          </div>
          {drives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document libraries found.
            </p>
          ) : (
            drives.map((d) => (
              <button
                key={d.id}
                className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted"
                onClick={() => openFolder(d)}
                disabled={loading}
              >
                <LibraryIcon className="h-4 w-4" /> {d.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Button
              size="icon"
              variant="ghost"
              disabled={loading}
              onClick={() =>
                view.item.parentId && view.item.path !== "/"
                  ? openFolder(drive, view.item.parentId)
                  : setView(null)
              }
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="truncate font-medium">
              {site.name} / {drive.name}
              {view.item.path === "/" ? "" : view.item.path}
            </span>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {view.folders.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">
                No subfolders.
              </p>
            ) : (
              view.folders.map((f) => (
                <button
                  key={f.id}
                  className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm hover:bg-muted"
                  onClick={() => openFolder(drive, f.id)}
                  disabled={loading}
                >
                  <span className="flex items-center gap-2 truncate">
                    <FolderIcon className="h-4 w-4 shrink-0" /> {f.name}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0" />
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {view.fileCount} file{view.fileCount === 1 ? "" : "s"} in this
            folder
          </p>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-between">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {site && drive && view ? (
          <Button
            size="sm"
            disabled={loading}
            onClick={() =>
              run(() =>
                onPick({
                  siteId: site.id,
                  siteName: site.name,
                  siteUrl: site.webUrl,
                  driveId: drive.id,
                  itemId: view.item.id,
                }),
              )
            }
          >
            {loading ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Sync this folder
          </Button>
        ) : null}
      </div>
    </>
  );
}
