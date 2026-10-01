"use client";

import { useEffect, useState, useTransition } from "react";
import {
  rejectApplicationAction,
  withdrawApplicationAction,
} from "@/actions/recruitment-applications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeReasons, type CloseKind } from "@/lib/recruitment/application/close-reasons";

const COPY: Record<CloseKind, { title: string; action: string; question: string; done: string }> = {
  reject: {
    title: "Reject application",
    action: "Reject",
    question: "Why is this candidate being rejected?",
    done: "Application rejected.",
  },
  withdraw: {
    title: "Withdraw application",
    action: "Withdraw",
    question: "Why did the candidate withdraw?",
    done: "Application withdrawn.",
  },
};

/**
 * Reject / withdraw with a required reason from a fixed list plus an optional
 * note. Self-contained so it can open from the detail page, the pipeline side
 * panel, or a kanban card without a page change.
 */
export function CloseApplicationDialog({
  kind,
  applicationId,
  candidateName,
  jobTitle,
  open,
  onOpenChange,
  onDone,
}: {
  kind: CloseKind;
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a success message after the application is closed. */
  onDone?: (message: string) => void;
}) {
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy = COPY[kind];

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) {
      setReasonCode(null);
      setNote("");
      setError(null);
    }
  }, [open]);

  const noteRequired = reasonCode === "other";
  const canSubmit = Boolean(reasonCode) && (!noteRequired || note.trim().length > 0);

  const submit = () => {
    if (!reasonCode || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      const action = kind === "reject" ? rejectApplicationAction : withdrawApplicationAction;
      const res = await action({}, { id: applicationId, reasonCode, note: note.trim() || undefined });
      if (res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onDone?.(copy.done);
    });
  };

  const who = [candidateName, jobTitle].filter(Boolean).join(" · ");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {who ? `${who}. You can reopen it later if needed.` : "You can reopen it later if needed."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <ErrorAlert message={error} /> : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{copy.question}</legend>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              {closeReasons(kind).map((r) => {
                const selected = reasonCode === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReasonCode(r.code)}
                    disabled={isPending}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor={`close-note-${applicationId}`}>
              Note{" "}
              <span className="font-normal text-muted-foreground">
                {noteRequired ? "(required for Other)" : "(optional)"}
              </span>
            </Label>
            <Textarea
              id={`close-note-${applicationId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === "reject" ? "e.g. Weak on SQL joins in the technical round" : "e.g. Joined a competitor"
              }
              rows={2}
              maxLength={1000}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "destructive" : "default"}
            size="sm"
            onClick={submit}
            loading={isPending}
            disabled={!canSubmit}
          >
            {isPending ? "Saving…" : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
