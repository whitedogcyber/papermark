import Link from "next/link";
import { useRouter } from "next/router";

import { useEffect, useState } from "react";

import { useTeam } from "@/context/team-context";
import {
  ArrowLeftIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { useDataroom } from "@/lib/swr/use-dataroom";
import { cn, fetcher, timeAgo } from "@/lib/utils";

import { DataroomHeader } from "@/components/datarooms/dataroom-header";
import { DataroomNavigation } from "@/components/datarooms/dataroom-navigation";
import AppLayout from "@/components/layouts/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ListItem = {
  id: string;
  title: string | null;
  isEnabled: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  pageNumber: number | null;
  link: { id: string; name: string | null } | null;
  document: { id: string; name: string } | null;
  viewerEmails: string[];
  lastMessage: { content: string; fromTeam: boolean; createdAt: string } | null;
  unread: number;
};

type Detail = {
  id: string;
  title: string | null;
  isEnabled: boolean;
  pageNumber: number | null;
  link: { id: string; name: string | null } | null;
  dataroomDocumentId: string | null;
  document: { id: string; name: string } | null;
  viewerEmails: string[];
  faqIds: string[];
  messages: {
    id: string;
    content: string;
    createdAt: string;
    fromTeam: boolean;
    author: string;
  }[];
};

type Faq = {
  id: string;
  title: string | null;
  editedQuestion: string;
  answer: string;
  visibilityMode: "PUBLIC_DATAROOM" | "PUBLIC_LINK" | "PUBLIC_DOCUMENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  linkId: string | null;
  dataroomDocumentId: string | null;
  sourceConversationId: string | null;
  questionMessageId: string | null;
  answerMessageId: string | null;
  link: { id: string; name: string | null } | null;
  dataroomDocument: { document: { name: string } } | null;
  createdAt: string;
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function Shell({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab: "questions" | "faqs";
}) {
  const { dataroom } = useDataroom();
  return (
    <AppLayout>
      <div className="relative mx-2 mb-10 mt-4 space-y-6 overflow-hidden px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        <header>
          <DataroomHeader
            title={dataroom?.name ?? ""}
            description={dataroom?.pId ?? ""}
            actions={[]}
          />
          <DataroomNavigation dataroomId={dataroom?.id} />
        </header>
        <div className="flex gap-2 border-b">
          {(
            [
              ["questions", "Questions", ""],
              ["faqs", "FAQs", "/faqs"],
            ] as const
          ).map(([id, label, path]) => (
            <Link
              key={id}
              href={`/datarooms/${dataroom?.id}/conversations${path}`}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === id
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </AppLayout>
  );
}

function useBase() {
  const router = useRouter();
  const teamId = useTeam()?.currentTeam?.id;
  const { id } = router.query as { id?: string };
  return teamId && id ? `/api/teams/${teamId}/datarooms/${id}` : null;
}

export function ConversationOverview() {
  const router = useRouter();
  const base = useBase();
  const { data, isLoading } = useSWR<ListItem[]>(
    base ? `${base}/conversations` : null,
    fetcher,
    { refreshInterval: 30000 },
  );
  const [filter, setFilter] = useState<"all" | "unanswered">("all");
  const items = (data ?? []).filter(
    (c) => filter === "all" || (c.lastMessage && !c.lastMessage.fromTeam),
  );

  return (
    <Shell tab="questions">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Visitors ask questions from links with Q&amp;A turned on. Turn it on
          in a link&apos;s settings.
        </p>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as typeof filter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unanswered">Unanswered</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                router.push(
                  `/datarooms/${router.query.id}/conversations/${c.id}`,
                )
              }
              className="flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-muted"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{c.title || "Question"}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.viewerEmails.join(", ") || "Visitor"}
                  {c.document ? ` · ${c.document.name}` : ""}
                  {c.pageNumber ? `, p. ${c.pageNumber}` : ""}
                  {c.link?.name ? ` · ${c.link.name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                <span>{timeAgo(c.lastMessageAt ?? c.createdAt)}</span>
                {c.unread > 0 ? (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-background">
                    {c.unread} new
                  </span>
                ) : c.lastMessage?.fromTeam ? (
                  <span>Answered</span>
                ) : (
                  <span>Waiting</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function ConversationDetail() {
  const router = useRouter();
  const base = useBase();
  const { conversationId, id } = router.query as {
    conversationId?: string;
    id?: string;
  };
  const url =
    base && conversationId ? `${base}/conversations/${conversationId}` : null;
  const { data, mutate } = useSWR<Detail>(url, fetcher, {
    refreshInterval: 20000,
  });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const sendReply = async () => {
    if (!url || !reply.trim()) return;
    setSending(true);
    try {
      await send(`${url}/messages`, "POST", { content: reply.trim() });
      setReply("");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!url || !window.confirm("Delete this conversation?")) return;
    try {
      await send(url, "DELETE");
      router.push(`/datarooms/${id}/conversations`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = async () => {
    if (!url || !data) return;
    await send(url, "PATCH", { isEnabled: !data.isEnabled });
    await mutate();
  };

  const firstQuestion = data?.messages.find((m) => !m.fromTeam);
  const lastAnswer = [...(data?.messages ?? [])]
    .reverse()
    .find((m) => m.fromTeam);

  return (
    <Shell tab="questions">
      <Link
        href={`/datarooms/${id}/conversations`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" /> All questions
      </Link>
      {!data ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                {data.title || "Question"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data.viewerEmails.join(", ") || "Visitor"}
                {data.document ? ` · ${data.document.name}` : ""}
                {data.pageNumber ? `, page ${data.pageNumber}` : ""}
                {data.link?.name ? ` · via ${data.link.name}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFaqOpen(true)}
                disabled={!lastAnswer}
                title={lastAnswer ? undefined : "Answer first"}
              >
                {data.faqIds.length ? "Publish another FAQ" : "Publish as FAQ"}
              </Button>
              <Button size="sm" variant="outline" onClick={toggle}>
                {data.isEnabled ? "Close" : "Reopen"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={remove}
                title="Delete"
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3 text-sm",
                  m.fromTeam
                    ? "ml-auto bg-foreground text-background"
                    : "bg-muted",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className="mt-1 text-xs opacity-70">
                  {m.author} · {timeAgo(m.createdAt)}
                </p>
              </div>
            ))}
          </div>

          {data.isEnabled ? (
            <div className="space-y-2">
              <Textarea
                rows={4}
                maxLength={5000}
                placeholder="Write an answer. The visitor gets it by email."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  onClick={sendReply}
                  loading={sending}
                  disabled={!reply.trim()}
                >
                  Send answer
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This conversation is closed.
            </p>
          )}

          {base ? (
            <FaqDialog
              open={faqOpen}
              setOpen={setFaqOpen}
              base={base}
              initial={{
                editedQuestion: firstQuestion?.content ?? "",
                originalQuestion: firstQuestion?.content ?? null,
                answer: lastAnswer?.content ?? "",
                sourceConversationId: data.id,
                questionMessageId: firstQuestion?.id ?? null,
                answerMessageId: lastAnswer?.id ?? null,
                linkId: data.link?.id ?? null,
                dataroomDocumentId: data.dataroomDocumentId,
              }}
              onSaved={() => mutate()}
            />
          ) : null}
        </div>
      )}
    </Shell>
  );
}

type FaqForm = {
  id?: string;
  editedQuestion: string;
  answer: string;
  originalQuestion?: string | null;
  visibilityMode?: Faq["visibilityMode"];
  status?: Faq["status"];
  linkId?: string | null;
  dataroomDocumentId?: string | null;
  sourceConversationId?: string | null;
  questionMessageId?: string | null;
  answerMessageId?: string | null;
};

function FaqDialog({
  open,
  setOpen,
  base,
  initial,
  onSaved,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  base: string;
  initial: FaqForm;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FaqForm>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        visibilityMode: "PUBLIC_DATAROOM",
        status: "PUBLISHED",
        ...initial,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const { id, ...body } = form;
      await send(
        id ? `${base}/faqs/${id}` : `${base}/faqs`,
        id ? "PUT" : "POST",
        body,
      );
      toast.success(id ? "FAQ updated" : "FAQ published");
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit FAQ" : "Publish FAQ"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            FAQs don&apos;t show who asked. Edit the question to remove anything
            private.
          </p>
          <div className="space-y-2">
            <Label>Question</Label>
            <Textarea
              rows={3}
              value={form.editedQuestion}
              onChange={(e) =>
                setForm({ ...form, editedQuestion: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Answer</Label>
            <Textarea
              rows={5}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Visible to</Label>
              <Select
                value={form.visibilityMode}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    visibilityMode: v as Faq["visibilityMode"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC_DATAROOM">
                    Everyone in the data room
                  </SelectItem>
                  <SelectItem value="PUBLIC_LINK" disabled={!form.linkId}>
                    Visitors of the same link
                  </SelectItem>
                  <SelectItem
                    value="PUBLIC_DOCUMENT"
                    disabled={!form.dataroomDocumentId}
                  >
                    Viewers of the same document
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as Faq["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={!form.editedQuestion.trim() || !form.answer.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const VISIBILITY_LABEL: Record<Faq["visibilityMode"], string> = {
  PUBLIC_DATAROOM: "Everyone",
  PUBLIC_LINK: "Link",
  PUBLIC_DOCUMENT: "Document",
};

export function FaqOverview() {
  const base = useBase();
  const { data, mutate, isLoading } = useSWR<Faq[]>(
    base ? `${base}/faqs` : null,
    fetcher,
  );
  const [editing, setEditing] = useState<FaqForm | null>(null);

  const remove = async (faq: Faq) => {
    if (!base || !window.confirm("Delete this FAQ?")) return;
    try {
      await send(`${base}/faqs/${faq.id}`, "DELETE");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Shell tab="faqs">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Published FAQs appear in the Questions panel for visitors.
        </p>
        <Button
          size="sm"
          onClick={() => setEditing({ editedQuestion: "", answer: "" })}
        >
          New FAQ
        </Button>
      </div>
      {isLoading ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No FAQs yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {data.map((f) => (
            <div
              key={f.id}
              className="flex items-start justify-between gap-4 p-4"
            >
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium">{f.editedQuestion}</p>
                <p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                  {f.answer}
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.status === "PUBLISHED"
                    ? "Published"
                    : f.status === "DRAFT"
                      ? "Draft"
                      : "Archived"}{" "}
                  · {VISIBILITY_LABEL[f.visibilityMode]}
                  {f.link?.name ? ` (${f.link.name})` : ""}
                  {f.dataroomDocument
                    ? ` (${f.dataroomDocument.document.name})`
                    : ""}{" "}
                  · {timeAgo(f.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Edit"
                  onClick={() => setEditing({ ...f })}
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Delete"
                  onClick={() => remove(f)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {base ? (
        <FaqDialog
          open={!!editing}
          setOpen={(v) => !v && setEditing(null)}
          base={base}
          initial={editing ?? { editedQuestion: "", answer: "" }}
          onSaved={() => mutate()}
        />
      ) : null}
    </Shell>
  );
}
