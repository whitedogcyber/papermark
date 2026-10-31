import { useEffect, useState } from "react";

import { useTeam } from "@/context/team-context";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { MAX_INVITES_PER_REQUEST, parseEmailList } from "./schema";

type GroupLink = { id: string; name: string | null; isArchived?: boolean };

/** Email people a link to a data room (one link, or a group's link). */
export function InviteViewersModal({
  open,
  setOpen,
  dataroomId,
  dataroomName,
  groupId,
  linkId,
  defaultEmails = [],
  onSuccess,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  dataroomId: string;
  dataroomName: string;
  groupId?: string;
  linkId?: string;
  defaultEmails?: string[];
  onSuccess?: () => void;
}) {
  const teamId = useTeam()?.currentTeam?.id;
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [chosenLink, setChosenLink] = useState<string | undefined>(linkId);
  const [sending, setSending] = useState(false);

  const { data: groupLinks } = useSWR<GroupLink[]>(
    open && teamId && groupId && !linkId
      ? `/api/teams/${teamId}/datarooms/${dataroomId}/groups/${groupId}/links`
      : null,
    fetcher,
  );
  const activeGroupLinks = (groupLinks ?? []).filter((l) => !l.isArchived);

  useEffect(() => {
    if (open) {
      setEmails(defaultEmails.join("\n"));
      setMessage("");
      setChosenLink(linkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!chosenLink && activeGroupLinks.length)
      setChosenLink(activeGroupLinks[0].id);
  }, [activeGroupLinks, chosenLink]);

  const { valid, invalid } = parseEmailList(emails);
  const tooMany = valid.length > MAX_INVITES_PER_REQUEST;
  const needsLink = !!groupId && !linkId;

  const send = async () => {
    if (!teamId || valid.length === 0 || tooMany) return;
    setSending(true);
    try {
      const url = linkId
        ? `/api/teams/${teamId}/datarooms/${dataroomId}/links/${linkId}/invite`
        : `/api/teams/${teamId}/datarooms/${dataroomId}/groups/${groupId}/invite`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: valid,
          message: message.trim() || undefined,
          ...(needsLink && chosenLink ? { linkId: chosenLink } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not send invitations");
      if (body.failed?.length) {
        toast.warning(
          `Sent ${body.sent}. Failed: ${body.failed.slice(0, 3).join(", ")}${body.failed.length > 3 ? "…" : ""}`,
        );
      } else {
        toast.success(`Invitation${body.sent === 1 ? "" : "s"} sent`);
      }
      onSuccess?.();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Each person gets an email with a link to {dataroomName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needsLink ? (
            <div className="space-y-2">
              <Label>Link to send</Label>
              {activeGroupLinks.length ? (
                <Select value={chosenLink} onValueChange={setChosenLink}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a link" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroupLinks.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name || l.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This group has no links yet. Create one first.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <Textarea
              id="invite-emails"
              rows={5}
              placeholder={"name@company.com\nother@company.com"}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {valid.length} valid
              {invalid.length
                ? `, ${invalid.length} not recognised (${invalid.slice(0, 2).join(", ")})`
                : ""}
              {tooMany
                ? `. Send at most ${MAX_INVITES_PER_REQUEST} at a time.`
                : ""}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-message">Message (optional)</Label>
            <Textarea
              id="invite-message"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={send}
            loading={sending}
            disabled={
              sending ||
              valid.length === 0 ||
              tooMany ||
              (needsLink && !chosenLink)
            }
          >
            Send {valid.length > 0 ? valid.length : ""} invitation
            {valid.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
