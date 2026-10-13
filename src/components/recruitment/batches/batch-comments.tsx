"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchComment } from "@/lib/recruitment/batch/batch-service";
import { cn } from "@/lib/utils";

type CommentsResponse = { comments?: BatchComment[]; error?: string };

/** Fetch, not server actions, so the panel's Esc and J/K never wait on a save. */
async function callComments(candidateId: string, body?: string, hrOnly = false): Promise<CommentsResponse> {
  try {
    const res = await fetch(`/api/recruitment/candidates/${encodeURIComponent(candidateId)}/comments`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify({ body, hrOnly }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as CommentsResponse;
    if (!res.ok) return { error: data.error ?? "Couldn't load comments. Please try again." };
    return data;
  } catch {
    return { error: "No connection. Please try again." };
  }
}

function when(value: Date): string {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Comments on a candidate in the batch panel. They are the candidate's notes,
 * so they also show on the profile. Enter sends, Shift+Enter is a new line.
 */
export function BatchComments({ candidateId, allowHrOnly = false }: { candidateId: string; allowHrOnly?: boolean }) {
  const router = useRouter();
  const [comments, setComments] = useState<BatchComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hrOnly, setHrOnly] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  // The person shown now, so a late save doesn't fill in someone else's list.
  const shownRef = useRef(candidateId);
  shownRef.current = candidateId;

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    setDraft("");
    setError(null);
    callComments(candidateId).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      setComments(res.comments ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    // Show it straight away; it is saved in the background.
    const tempId = `sending-${Date.now()}`;
    setComments((prev) => [...(prev ?? []), { id: tempId, body, authorName: "You", mine: true, hrOnly, createdAt: new Date() }]);
    setDraft("");
    setSending(true);
    try {
      const res = await callComments(candidateId, body, hrOnly);
      if (shownRef.current !== candidateId) return;
      if (res.error || !res.comments) {
        setComments((prev) => (prev ?? []).filter((c) => c.id !== tempId));
        setDraft(body);
        setError(res.error ?? "Couldn't save the comment.");
        return;
      }
      setComments(res.comments);
    } finally {
      setSending(false);
      router.refresh();
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Comments{comments && comments.length > 0 ? ` (${comments.length})` : ""}
      </h3>
      {comments === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul ref={listRef} className="max-h-64 space-y-2 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className={cn("rounded-lg px-3 py-2 text-sm", c.mine ? "bg-accent-blue-muted" : "bg-muted")}>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.mine ? "You" : c.authorName}</span> ·{" "}
                {c.id.startsWith("sending-") ? "Sending…" : when(c.createdAt)}
                {c.hrOnly ? <span className="ml-1.5 rounded bg-background px-1.5 py-0.5 text-[10px] font-medium">HR only</span> : null}
              </p>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={5000}
          placeholder="Write a comment"
          aria-label="Write a comment"
          className="min-h-[2.5rem] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" onClick={send} disabled={sending || !draft.trim()} aria-label="Send comment">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {allowHrOnly ? (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hrOnly} onChange={(e) => setHrOnly(e.target.checked)} className="h-3.5 w-3.5" />
          Only HR can see this comment
        </label>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
