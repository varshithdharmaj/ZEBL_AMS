"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBatchAction } from "@/actions/recruitment-batches";

export function todayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export type NewBatchValues = { interviewDate: string; name: string };

/** Interview date (required) and an optional name, shared by New batch and Add to batch. */
export function NewBatchFields({
  value,
  onChange,
  autoFocus,
}: {
  value: NewBatchValues;
  onChange: (next: NewBatchValues) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
      <div className="space-y-1.5">
        <Label htmlFor="batch-interview-date">Interview date</Label>
        <Input
          id="batch-interview-date"
          type="date"
          required
          value={value.interviewDate}
          onChange={(e) => onChange({ ...value, interviewDate: e.target.value })}
          autoFocus={autoFocus}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="batch-name">
          Name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="batch-name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Medical Billing"
          maxLength={120}
        />
      </div>
    </div>
  );
}

/** "+ New batch": interview date and optional name, then into the (empty) batch. */
export function NewBatchButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NewBatchValues>({ interviewDate: todayIst(), name: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBatchAction({ interviewDate: values.interviewDate, name: values.name.trim() || null });
      if (res.error || !res.batchId) {
        setError(res.error ?? "Couldn't create the batch.");
        return;
      }
      setOpen(false);
      setValues({ interviewDate: todayIst(), name: "" });
      router.push(`/admin/recruitment/batches/${res.batchId}`);
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New batch
      </Button>
      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New batch</DialogTitle>
              <DialogDescription>
                The Batch ID is given automatically. Add candidates from the Pipeline list afterwards.
              </DialogDescription>
            </DialogHeader>
            <NewBatchFields value={values} onChange={setValues} autoFocus />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !values.interviewDate}>
                {isPending ? "Creating…" : "Create batch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
