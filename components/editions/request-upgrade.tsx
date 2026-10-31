import { useEffect, useState } from "react";

import { useTeam } from "@/context/team-context";
import { CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  EDITIONS,
  Edition,
  EditionId,
  editionById,
  planDisplayName,
  planRank,
} from "@/lib/editions";
import { usePlan } from "@/lib/swr/use-billing";
import { cn, fetcher, timeAgo } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type UpgradeRequest = {
  id: string;
  kind: "edition" | "seats";
  requestedEdition: EditionId | null;
  requestedSeats: number | null;
  message: string | null;
  status: string;
  createdAt: string;
};

export function useOpenUpgradeRequests() {
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;
  const { data, mutate } = useSWR<UpgradeRequest[]>(
    teamId ? `/api/teams/${teamId}/upgrade-requests` : null,
    fetcher,
  );
  return { requests: data ?? [], mutate, teamId };
}

export function EditionCard({
  edition,
  selected,
  current,
  onSelect,
  compact,
}: {
  edition: Edition;
  selected?: boolean;
  current?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={onSelect}
      className={cn(
        "flex h-full flex-col rounded-lg border bg-background p-4 text-left transition-colors",
        onSelect && "hover:border-foreground/60",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">{edition.name}</span>
        {current ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{edition.summary}</p>
      {!compact ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {edition.features.map((f) => (
            <li key={f} className="flex gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}

/**
 * Body of the "request an upgrade" dialog. No pricing: the request is stored
 * and routed to the WhiteDog team, who assign the edition.
 */
export function RequestUpgradeForm({
  kind = "edition",
  suggested,
  trigger,
  onDone,
  inDialog = true,
}: {
  kind?: "edition" | "seats";
  suggested?: EditionId;
  trigger?: string;
  onDone?: () => void;
  /** false when rendered on a page (no Dialog context) */
  inDialog?: boolean;
}) {
  const { plan } = usePlan();
  const { requests, mutate, teamId } = useOpenUpgradeRequests();
  const pending = requests.find((r) => r.kind === kind);
  const rank = planRank(plan);
  const options = EDITIONS.filter((_, i) => i > rank);

  const [edition, setEdition] = useState<EditionId | undefined>(
    suggested && options.some((e) => e.id === suggested)
      ? suggested
      : (options[0]?.id ?? "complete"),
  );
  const [seats, setSeats] = useState<number>(5);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pending) {
      if (pending.requestedEdition) setEdition(pending.requestedEdition);
      if (pending.requestedSeats) setSeats(pending.requestedSeats);
      setMessage(pending.message ?? "");
    }
  }, [pending]);

  const submit = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/upgrade-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "seats"
            ? { kind, seats, message, trigger }
            : { kind, edition, message, trigger },
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not send the request");
      }
      await mutate();
      toast.success("Request sent. We'll be in touch.");
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const currentName = planDisplayName(plan);
  const title =
    kind === "seats" ? "Request more team members" : "Request an upgrade";
  const description = (
    <>
      Your team is on <strong>{currentName}</strong>. Send a request and the
      WhiteDog Share team will follow up.
    </>
  );

  return (
    <div className="space-y-5">
      {inDialog ? (
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
      ) : (
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {pending ? (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You requested{" "}
            {pending.kind === "seats"
              ? `${pending.requestedSeats} team members`
              : editionById(pending.requestedEdition)?.name}{" "}
            {timeAgo(pending.createdAt)}. Sending again updates that request.
          </span>
        </div>
      ) : null}

      {kind === "seats" ? (
        <div className="space-y-2">
          <Label htmlFor="seats">Total team members needed</Label>
          <Input
            id="seats"
            type="number"
            min={1}
            max={1000}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value) || 1)}
            className="w-32"
          />
        </div>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You already have the highest edition. Use the message below for
          anything else you need.
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            options.length > 1 ? "sm:grid-cols-2" : "",
            options.length > 2 ? "lg:grid-cols-3" : "",
          )}
        >
          {options.map((e) => (
            <EditionCard
              key={e.id}
              edition={e}
              selected={edition === e.id}
              onSelect={() => setEdition(e.id)}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="upgrade-message">Message (optional)</Label>
        <Textarea
          id="upgrade-message"
          rows={3}
          maxLength={2000}
          placeholder="What do you need it for, and by when?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={
            saving || (kind === "edition" && options.length > 0 && !edition)
          }
        >
          {saving ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {pending ? "Update request" : "Send request"}
        </Button>
      </div>
    </div>
  );
}
