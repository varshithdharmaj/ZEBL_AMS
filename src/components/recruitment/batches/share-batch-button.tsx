"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listBatchManagersAction,
  searchManagersAction,
  shareBatchAction,
  unshareBatchAction,
} from "@/actions/recruitment-batches";
import type { BatchManagerOption } from "@/lib/recruitment/batch/batch-service";

/**
 * "Share with manager": the managers who can see this batch, and a search to
 * add more. A shared manager sees the candidates, rates the Manager Round and
 * decides Hire / Reject / Hold for people in it.
 */
export function ShareBatchButton({
  batchId,
  batchCode,
  sharedCount,
}: {
  batchId: string;
  batchCode: string;
  sharedCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [managers, setManagers] = useState<BatchManagerOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<BatchManagerOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadManagers() {
    const res = await listBatchManagersAction({ batchId });
    if (res.error) setError(res.error);
    else setManagers(res.managers ?? []);
  }

  useEffect(() => {
    if (!open) return;
    void loadManagers();
    // loadManagers only reads batchId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batchId]);

  // Search as HR types (short pause so each key doesn't hit the server).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await searchManagersAction({ batchId, query });
      if (res.error) setError(res.error);
      else setOptions(res.options ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, batchId, managers]);

  function close(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setQuery("");
      setOptions(null);
      setError(null);
    }
  }

  function add(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await shareBatchAction({ batchId, userIds: [userId] });
      if (res.error) {
        setError(res.error);
        return;
      }
      await loadManagers();
      router.refresh();
    });
  }

  function remove(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await unshareBatchAction({ batchId, userId });
      if (res.error) {
        setError(res.error);
        return;
      }
      await loadManagers();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {sharedCount > 0 ? `Shared with ${sharedCount}` : "Share with manager"}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share {batchCode} with a manager</DialogTitle>
            <DialogDescription>
              They see these candidates, rate the Manager Round and decide Hire, Reject or Hold for people in it.
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Can see this batch</h3>
            {managers === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Only HR, for now.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {managers.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{m.designation ?? m.email}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => remove(m.userId)}
                      aria-label={`Stop sharing with ${m.name}`}
                      title="Stop sharing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a manager</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                className="pl-8"
                aria-label="Search managers"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
              {options === null ? (
                <p className="p-3 text-sm text-muted-foreground">Loading…</p>
              ) : options.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {query ? "No one matches." : "No one else to add."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {options.map((o) => (
                    <li key={o.userId} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{o.designation ?? o.email}</span>
                      </span>
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => add(o.userId)}>
                        Share
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
