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

/** "+ New batch": optional name, then straight into the new batch's sheet. */
export function NewBatchButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBatchAction({ name: name.trim() || null });
      if (res.error || !res.batchId) {
        setError(res.error ?? "Couldn't create the batch.");
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/admin/recruitment/batches/${res.batchId}?paste=1`);
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
              <DialogDescription>The Batch ID is given automatically. A name is optional.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="batch-name">Name</Label>
              <Input
                id="batch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Medical Billing Oct week 1"
                maxLength={120}
                autoFocus
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create batch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
