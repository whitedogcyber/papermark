"use client";

import { useState } from "react";

import { ArrowLeftIcon, Loader2Icon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { cn, fetcher, timeAgo } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

export type ConversationSidebarProps = {
  dataroomId?: string;
  documentId?: string;
  pageNumber?: number;
  viewId: string;
  viewerId?: string;
  linkId: string;
  isEnabled: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

type Thread = {
  id: string;
  title: string | null;
  createdAt: string;
  pageNumber: number | null;
  document: { id: string; name: string } | null;
  messages: {
    id: string;
    content: string;
    createdAt: string;
    fromTeam: boolean;
  }[];
};

type Faq = {
  id: string;
  question: string;
  answer: string;
  pageNumber: number | null;
  document: { id: string; name: string } | null;
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

/** Visitor Q&A panel: ask the team, follow your threads, read FAQs. */
export function ConversationSidebar({
  dataroomId,
  documentId,
  pageNumber,
  linkId,
  isEnabled,
  isOpen,
  onOpenChange,
}: ConversationSidebarProps) {
  const qs = `linkId=${encodeURIComponent(linkId)}&dataroomId=${encodeURIComponent(dataroomId ?? "")}`;
  const [tab, setTab] = useState<"questions" | "faq">("questions");
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [aboutPage, setAboutPage] = useState(true);
  const [sending, setSending] = useState(false);

  const {
    data: threads,
    error: threadsError,
    mutate,
  } = useSWR<Thread[]>(
    isOpen && isEnabled && dataroomId ? `/api/conversations?${qs}` : null,
    fetcher,
    {
      refreshInterval: isOpen ? 20000 : 0,
    },
  );
  const { data: faqs } = useSWR<Faq[]>(
    isOpen && isEnabled && dataroomId
      ? `/api/conversations/faqs?${qs}${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ""}`
      : null,
    fetcher,
  );

  const thread = threads?.find((t) => t.id === openThread) ?? null;

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      if (thread) {
        await post(`/api/conversations/${thread.id}/messages`, {
          linkId,
          dataroomId,
          content,
        });
      } else {
        const created = await post("/api/conversations", {
          linkId,
          dataroomId,
          content,
          ...(documentId ? { documentId } : {}),
          ...(documentId && aboutPage && pageNumber ? { pageNumber } : {}),
        });
        setOpenThread(created.id);
      }
      setDraft("");
      await mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Questions</SheetTitle>
          <SheetDescription>
            Ask the data room team. Only you and the team see your questions.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 border-b">
          {(["questions", "faq"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setOpenThread(null);
              }}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === t
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {t === "questions"
                ? "My questions"
                : `FAQ${faqs?.length ? ` (${faqs.length})` : ""}`}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "faq" ? (
            !faqs ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No FAQs yet.</p>
            ) : (
              <div className="space-y-4">
                {faqs.map((f) => (
                  <div key={f.id} className="space-y-1 text-sm">
                    <p className="font-medium">{f.question}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {f.answer}
                    </p>
                    {f.document ? (
                      <p className="text-xs text-muted-foreground">
                        {f.document.name}
                        {f.pageNumber ? `, page ${f.pageNumber}` : ""}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )
          ) : threadsError ? (
            <p className="text-sm text-muted-foreground">
              {threadsError.message}
            </p>
          ) : !threads ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : thread ? (
            <div className="space-y-3">
              <button
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setOpenThread(null)}
              >
                <ArrowLeftIcon className="h-4 w-4" /> All questions
              </button>
              {thread.document ? (
                <p className="text-xs text-muted-foreground">
                  About {thread.document.name}
                  {thread.pageNumber ? `, page ${thread.pageNumber}` : ""}
                </p>
              ) : null}
              {thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.fromTeam
                      ? "bg-muted"
                      : "ml-auto bg-foreground text-background",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {m.fromTeam ? "Team" : "You"} · {timeAgo(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t asked anything yet.
            </p>
          ) : (
            <div className="space-y-2">
              {threads.map((t) => {
                const last = t.messages[t.messages.length - 1];
                return (
                  <button
                    key={t.id}
                    onClick={() => setOpenThread(t.id)}
                    className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
                  >
                    <p className="line-clamp-2 font-medium">
                      {t.title || t.messages[0]?.content}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {last?.fromTeam ? "Answered" : "Waiting for an answer"} ·{" "}
                      {timeAgo(last?.createdAt ?? t.createdAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {tab === "questions" && !threadsError ? (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              rows={3}
              maxLength={5000}
              placeholder={thread ? "Write a reply" : "Ask a question"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              {!thread && documentId && pageNumber ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={aboutPage}
                    onCheckedChange={(v) => setAboutPage(v === true)}
                  />
                  About page {pageNumber}
                </label>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                onClick={send}
                disabled={sending || !draft.trim()}
              >
                {sending ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquareIcon className="mr-2 h-4 w-4" />
                )}
                {thread ? "Reply" : "Ask"}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
