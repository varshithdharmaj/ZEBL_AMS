"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addToBatchAction, searchCandidatesForBatchAction } from "@/actions/recruitment-batches";
import type { BatchCandidateOption } from "@/lib/recruitment/batch/batch-service";

/**
 * "Add candidates" on the batch page: search people with an open application
 * who aren't in another open batch, tick them, add them. Saves a trip to the
 * Pipeline list.
 */
export function AddCandidatesButton({ batchId, batchCode }: { batchId: string; batchCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BatchCandidateOption[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Search as HR types (short pause so each key doesn't hit the server).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await searchCandidatesForBatchAction({ batchId, query });
      if (res.error) setMessage({ tone: "error", text: res.error });
      else setOptions(res.options ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, batchId]);

  function close(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setQuery("");
      setOptions(null);
      setPicked(new Set());
      setMessage(null);
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    setMessage(null);
    startTransition(async () => {
      const res = await addToBatchAction({ applicationIds: [...picked], target: { kind: "existing", batchId } });
      if (res.error || !res.result) {
        setMessage({ tone: "error", text: res.error ?? "Couldn't add them. Please try again." });
        return;
      }
      const { added, skipped } = res.result;
      router.refresh();
      if (skipped.length === 0) {
        close(false);
        return;
      }
      setPicked(new Set());
      setMessage({
        tone: "ok",
        text: `Added ${added}. Not added: ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`,
      });
      const refreshed = await searchCandidatesForBatchAction({ batchId, query });
      setOptions(refreshed.options ?? []);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add candidates
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add candidates to {batchCode}</DialogTitle>
            <DialogDescription>People already in another open batch aren&apos;t listed.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="add-candidates-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or phone"
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {options === null ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : options.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {query ? "No one matches. Check the spelling, or they may already be in an open batch." : "No candidates to add."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {options.map((o) => (
                  <li key={o.applicationId}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <Checkbox checked={picked.has(o.applicationId)} onCheckedChange={() => toggle(o.applicationId)} aria-label={`Select ${o.name}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.role} · {o.stageLabel}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {message ? (
            <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
              {message.text}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={add} disabled={isPending || picked.size === 0}>
              {isPending ? "Adding…" : picked.size === 0 ? "Add" : `Add ${picked.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
