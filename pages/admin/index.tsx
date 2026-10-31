import { useRouter } from "next/router";

import { useEffect, useState } from "react";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  EDITIONS,
  LEGACY_PLANS,
  PENDING_PLAN,
  basePlan,
  editionById,
  planDisplayName,
} from "@/lib/editions";
import { usePlatformAdmin } from "@/lib/swr/use-platform-admin";
import { cn, fetcher, timeAgo } from "@/lib/utils";

import AppLayout from "@/components/layouts/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AdminRequest = {
  id: string;
  kind: "edition" | "seats";
  requestedEdition: string | null;
  requestedSeats: number | null;
  currentPlan: string;
  message: string | null;
  trigger: string | null;
  requestedByEmail: string | null;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  team: { id: string; name: string; plan: string };
};

type AdminTeam = {
  id: string;
  name: string;
  plan: string;
  limits: Record<string, number> | null;
  createdAt: string;
  members: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
  }[];
  counts: { documents: number; datarooms: number; links: number };
  openRequests: number;
};

const PLAN_OPTIONS = [
  { value: PENDING_PLAN, label: "Pending approval (no access)" },
  ...EDITIONS.map((e) => ({ value: e.plan, label: e.name })),
];

const OVERRIDES = ["users", "datarooms", "domains"] as const;

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, loading } = usePlatformAdmin();
  const [tab, setTab] = useState<"requests" | "teams">("requests");

  return (
    <AppLayout>
      <main className="mx-2 mb-10 mt-4 space-y-6 px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Assign editions and handle upgrade requests for every team.
          </p>
        </div>

        {loading ? (
          <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !isAdmin ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to this page.
          </p>
        ) : (
          <>
            <div className="flex gap-2 border-b">
              {(["requests", "teams"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm capitalize",
                    tab === t
                      ? "border-foreground font-medium"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "requests" ? (
              <RequestsTab
                highlight={router.query.request as string | undefined}
              />
            ) : (
              <TeamsTab />
            )}
          </>
        )}
      </main>
    </AppLayout>
  );
}

function RequestsTab({ highlight }: { highlight?: string }) {
  const [status, setStatus] = useState("open");
  const { data, mutate, isLoading } = useSWR<AdminRequest[]>(
    `/api/admin/requests?status=${status}`,
    fetcher,
  );

  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="declined">Declined</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No requests.</p>
      ) : (
        data.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            highlighted={r.id === highlight}
            onChange={() => mutate()}
          />
        ))
      )}
    </div>
  );
}

function RequestRow({
  request: r,
  highlighted,
  onChange,
}: {
  request: AdminRequest;
  highlighted?: boolean;
  onChange: () => void;
}) {
  const [edition, setEdition] = useState(r.requestedEdition ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);

  const resolve = async (action: "approve" | "decline") => {
    setBusy(action);
    try {
      await send(`/api/admin/requests/${r.id}`, "PATCH", {
        action,
        note: note || undefined,
        ...(r.kind === "edition" && edition ? { edition } : {}),
      });
      toast.success(action === "approve" ? "Approved" : "Declined");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const requested =
    r.kind === "seats"
      ? `${r.requestedSeats} team members`
      : (editionById(r.requestedEdition)?.name ?? "Edition");

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border bg-background p-4 text-sm",
        highlighted && "ring-2 ring-foreground",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium">{r.team.name}</span>
          <span className="text-muted-foreground">
            {" "}
            · {planDisplayName(r.team.plan)} → <strong>{requested}</strong>
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {r.requestedByEmail ?? "Unknown"} · {timeAgo(r.createdAt)}
          {r.trigger ? ` · from ${r.trigger}` : ""}
        </span>
      </div>
      {r.message ? (
        <p className="whitespace-pre-wrap rounded bg-muted p-2">{r.message}</p>
      ) : null}

      {r.status === "open" ? (
        <div className="flex flex-wrap items-center gap-2">
          {r.kind === "edition" ? (
            <Select value={edition} onValueChange={setEdition}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Edition" />
              </SelectTrigger>
              <SelectContent>
                {EDITIONS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            className="min-w-48 flex-1"
            placeholder="Note to the requester (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!!busy}
            onClick={() => resolve("approve")}
          >
            {busy === "approve" ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => resolve("decline")}
          >
            Decline
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {r.status === "approved" ? "Approved" : "Declined"}{" "}
          {r.resolvedAt ? timeAgo(r.resolvedAt) : ""}
          {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
        </p>
      )}
    </div>
  );
}

function TeamsTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { data, mutate, isLoading } = useSWR<AdminTeam[]>(
    `/api/admin/teams?q=${encodeURIComponent(search)}`,
    fetcher,
  );

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <Input
          placeholder="Team name, or a person's email or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <SearchIcon className="mr-2 h-4 w-4" /> Search
        </Button>
      </form>

      {isLoading ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No teams found.</p>
      ) : (
        data.map((t) => (
          <TeamRow key={t.id} team={t} onChange={() => mutate()} />
        ))
      )}
    </div>
  );
}

function TeamRow({
  team,
  onChange,
}: {
  team: AdminTeam;
  onChange: () => void;
}) {
  const current = basePlan(team.plan);
  const [plan, setPlan] = useState(current);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlan(basePlan(team.plan));
    setOverrides(
      Object.fromEntries(
        OVERRIDES.map((k) => [
          k,
          team.limits?.[k] != null ? String(team.limits[k]) : "",
        ]),
      ),
    );
  }, [team]);

  const options = LEGACY_PLANS[current]
    ? [...PLAN_OPTIONS, { value: current, label: LEGACY_PLANS[current] }]
    : PLAN_OPTIONS;

  const overridesChanged = OVERRIDES.some(
    (k) =>
      (overrides[k] || "") !==
      (team.limits?.[k] != null ? String(team.limits[k]) : ""),
  );
  const dirty = plan !== current || overridesChanged;

  const save = async () => {
    setSaving(true);
    try {
      const limits = overridesChanged
        ? {
            ...(team.limits ?? {}),
            ...Object.fromEntries(
              OVERRIDES.map((k) => [
                k,
                overrides[k] === "" ? null : Number(overrides[k]),
              ]),
            ),
          }
        : undefined;
      await send(`/api/admin/teams/${team.id}`, "PATCH", {
        ...(plan !== current ? { plan } : {}),
        ...(limits ? { limits } : {}),
        reason: reason || undefined,
      });
      toast.success(`${team.name} updated`);
      setReason("");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium">{team.name}</span>
          <span className="text-muted-foreground">
            {" "}
            · {planDisplayName(team.plan)}
          </span>
          {team.openRequests ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {team.openRequests} open request{team.openRequests > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {team.counts.documents} docs · {team.counts.datarooms} data rooms ·
          created {timeAgo(team.createdAt)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {team.members
          .map(
            (m) =>
              `${m.email ?? m.name ?? m.id}${m.role === "ADMIN" ? " (admin)" : ""}`,
          )
          .join(", ") || "No members"}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Edition</span>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {OVERRIDES.map((k) => (
          <div key={k} className="space-y-1">
            <span className="text-xs capitalize text-muted-foreground">
              {k === "users"
                ? "Team members"
                : k === "datarooms"
                  ? "Data rooms"
                  : "Domains"}
            </span>
            <Input
              type="number"
              min={0}
              className="w-28"
              placeholder="Default"
              value={overrides[k] ?? ""}
              onChange={(e) =>
                setOverrides({ ...overrides, [k]: e.target.value })
              }
            />
          </div>
        ))}
        <Input
          className="min-w-48 flex-1"
          placeholder="Reason (optional, kept in history)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </div>
  );
}
