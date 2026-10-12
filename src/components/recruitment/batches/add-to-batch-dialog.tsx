"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addToBatchAction, listOpenBatchesAction, type AddToBatchState } from "@/actions/recruitment-batches";
import type { OpenBatchOption } from "@/lib/recruitment/batch/batch-service";
import { formatInterviewDate } from "@/lib/recruitment/batch/batch-membership";
import { NewBatchFields, todayIst, type NewBatchValues } from "@/components/recruitment/batches/new-batch-button";

const NEW = "__new__";

export function AddToBatchDialog({
  open,
  onOpenChange,
  applicationIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationIds: string[];
  /** Called on close when anyone was added; the parent clears its selection. */
  onAdded: () => void;
}) {
  const [batches, setBatches] = useState<OpenBatchOption[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [values, setValues] = useState<NewBatchValues>({ interviewDate: todayIst(), name: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AddToBatchState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setError(null);
    let cancelled = false;
    void listOpenBatchesAction().then((res) => {
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setBatches([]);
        return;
      }
      setBatches(res.batches ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const target = picked || (batches ? (batches[0]?.id ?? NEW) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addToBatchAction({
        applicationIds,
        target:
          target === NEW
            ? { kind: "new", batch: { interviewDate: values.interviewDate, name: values.name.trim() || null } }
            : { kind: "existing", batchId: target },
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(res);
    });
  }

  function close() {
    onOpenChange(false);
    if ((done?.result?.added ?? 0) > 0) onAdded();
  }

  const count = applicationIds.length;
  const chosen = batches?.find((b) => b.id === target);
  const doneCode = done?.code ?? chosen?.code;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && (next ? onOpenChange(true) : close())}>
      <DialogContent>
        {done?.result ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {done.result.added > 0
                  ? `Added ${done.result.added} to ${doneCode ?? "the batch"}`
                  : "Nobody was added"}
              </DialogTitle>
              {done.result.skipped.length > 0 ? (
                <DialogDescription>
                  {done.result.skipped.length} skipped:
                </DialogDescription>
              ) : null}
            </DialogHeader>
            {done.result.skipped.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {done.result.skipped.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.name}</span>{" "}
                    <span className="text-muted-foreground">— {s.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              {done.batchId && done.result.added > 0 ? (
                <Button asChild>
                  <Link href={`/admin/recruitment/batches/${done.batchId}`}>Open batch</Link>
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                Add {count} candidate{count === 1 ? "" : "s"} to a batch
              </DialogTitle>
              <DialogDescription>A candidate can be in only one open batch at a time.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="add-to-batch-target">Batch</Label>
              <Select value={target} onValueChange={setPicked} disabled={batches == null}>
                <SelectTrigger id="add-to-batch-target" className="bg-background">
                  <SelectValue placeholder={batches == null ? "Loading batches…" : "Pick a batch"} />
                </SelectTrigger>
                <SelectContent>
                  {(batches ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-mono">{b.code}</span>
                      {b.interviewDate ? ` · ${formatInterviewDate(b.interviewDate)}` : ""}
                      {b.name ? ` · ${b.name}` : ""}
                      <span className="text-muted-foreground"> ({b.candidateCount})</span>
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>+ New batch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {target === NEW ? <NewBatchFields value={values} onChange={setValues} /> : null}

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !target || (target === NEW && !values.interviewDate)}
              >
                {isPending ? "Adding…" : target === NEW ? "Create batch and add" : "Add to batch"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
