"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { importBatchPasteAction, previewBatchPasteAction } from "@/actions/recruitment-batches";
import type { PasteImportResult, PasteOutcome, PastePreview } from "@/lib/recruitment/batch/batch-service";
import { cn } from "@/lib/utils";

const OUTCOME: Record<PasteOutcome, { label: string; className: string }> = {
  new: { label: "New", className: "bg-success-muted text-success" },
  existing: { label: "Already in system", className: "bg-accent-blue-muted text-accent-blue" },
  in_this_batch: { label: "Skipped", className: "bg-muted text-muted-foreground" },
  in_other_batch: { label: "Skipped", className: "bg-warning-muted text-warning" },
  error: { label: "Skipped", className: "bg-danger-muted text-danger" },
};

type Step = "paste" | "preview" | "done";

export function BatchPasteDialog({
  open,
  onOpenChange,
  batchId,
  jobs,
  defaultJobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  jobs: Array<{ id: string; title: string; status: string }>;
  defaultJobId: string | null;
}) {
  const [step, setStep] = useState<Step>("paste");
  const [jobId, setJobId] = useState<string>(defaultJobId ?? (jobs.length === 1 ? jobs[0].id : ""));
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PastePreview | null>(null);
  const [result, setResult] = useState<PasteImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setStep("paste");
      setText("");
      setPreview(null);
      setResult(null);
      setError(null);
      setJobId((current) => current || defaultJobId || (jobs.length === 1 ? jobs[0].id : ""));
    }
  }, [open, defaultJobId, jobs]);

  function runPreview(pasted: string, role: string) {
    setError(null);
    if (!role) {
      setError("Pick the role these candidates applied for.");
      return;
    }
    if (!pasted.trim()) {
      setError("Paste the rows from Excel first.");
      return;
    }
    startTransition(async () => {
      const res = await previewBatchPasteAction({ batchId, jobOpeningId: role, text: pasted });
      if (res.error || !res.preview) {
        setError(res.error ?? "Couldn't read the pasted rows.");
        return;
      }
      setPreview(res.preview);
      setStep("preview");
    });
  }

  function runImport() {
    setError(null);
    startTransition(async () => {
      const res = await importBatchPasteAction({ batchId, jobOpeningId: jobId, text });
      if (res.error || !res.result) {
        setError(res.error ?? "Couldn't add the candidates.");
        return;
      }
      // The action refreshes the sheet behind the dialog.
      setResult(res.result);
      setStep("done");
    });
  }

  const toAdd = preview ? preview.counts.new + preview.counts.existing : 0;
  const skipped = preview ? preview.rows.length - toAdd : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === "done" ? "Candidates added" : step === "preview" ? "Check before adding" : "Paste from Excel"}
          </DialogTitle>
          <DialogDescription>
            {step === "paste"
              ? "In your Excel sheet, select the rows (with or without the header row), press Ctrl+C, then click below and press Ctrl+V."
              : step === "preview"
                ? "Nothing is saved yet. People already in the system are linked, not added again."
                : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto">
          {step === "paste" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="paste-role">Role they applied for</Label>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    There are no open jobs yet.{" "}
                    <Link href="/admin/recruitment/jobs/new" className="underline">
                      Create a job
                    </Link>{" "}
                    first, then come back.
                  </p>
                ) : (
                  <Select value={jobId} onValueChange={setJobId}>
                    <SelectTrigger id="paste-role" className="h-10 max-w-md">
                      <SelectValue placeholder="Pick a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                          {j.status !== "open" ? ` (${j.status.replace("_", " ")})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paste-rows">Rows</Label>
                <textarea
                  id="paste-rows"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (!pasted) return;
                    e.preventDefault();
                    setText(pasted);
                    if (jobId) runPreview(pasted, jobId);
                  }}
                  rows={10}
                  spellCheck={false}
                  placeholder={"Sl.no\tName\tEmail ID\tPhone Number\tCurrent Location\tQualification\tTotal Experience\tRemarks\tAvailability\tCandidate profile"}
                  className="w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring/40"
                />
                <p className="text-xs text-muted-foreground">
                  Columns in the usual order: Sl.no, Name, Email ID, Phone Number, Current Location, Qualification,
                  Total Experience, Remarks, Availability, Candidate profile.
                </p>
              </div>
            </>
          ) : null}

          {step === "preview" && preview ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{preview.counts.new}</span> new ·{" "}
                <span className="font-medium">{preview.counts.existing}</span> already in system
                {skipped > 0 ? (
                  <>
                    {" "}
                    · <span className="font-medium">{skipped}</span> skipped
                  </>
                ) : null}
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Row</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Phone</th>
                      <th className="px-2 py-2 font-medium">Location</th>
                      <th className="px-2 py-2 font-medium">Qualification</th>
                      <th className="px-2 py-2 text-right font-medium">Exp (yrs)</th>
                      <th className="px-2 py-2 font-medium">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((r) => {
                      const o = OUTCOME[r.outcome];
                      const note = [r.message, ...r.warnings].filter(Boolean);
                      return (
                        <tr key={r.line} className={cn(r.outcome !== "new" && r.outcome !== "existing" && "opacity-70")}>
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                          <td className="px-2 py-1.5">
                            <span className={cn("inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-medium", o.className)}>
                              {o.label}
                            </span>
                            {note.length > 0 ? (
                              <span className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                                {r.warnings.length > 0 ? <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" /> : null}
                                {note.join(" ")}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 font-medium">{r.name || "—"}</td>
                          <td className="px-2 py-1.5">{r.email ?? "—"}</td>
                          <td className="px-2 py-1.5 tabular-nums">{r.phone ?? "—"}</td>
                          <td className="px-2 py-1.5">{r.location ?? "—"}</td>
                          <td className="px-2 py-1.5">{r.qualification ?? "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{r.experienceYears ?? "—"}</td>
                          <td className="px-2 py-1.5">{r.availability ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {step === "done" && result ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Added {result.added} new candidate{result.added === 1 ? "" : "s"}
                {result.linked > 0 ? ` and linked ${result.linked} already in the system` : ""}.
              </p>
              {result.skipped.length > 0 ? (
                <div className="rounded-lg border border-border">
                  <p className="border-b border-border px-3 py-2 text-sm font-medium">
                    {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} not added
                  </p>
                  <ul className="divide-y divide-border text-sm">
                    {result.skipped.map((s) => (
                      <li key={s.line} className="flex gap-3 px-3 py-2">
                        <span className="w-12 shrink-0 tabular-nums text-muted-foreground">Row {s.line}</span>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {step === "paste" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={() => runPreview(text, jobId)} disabled={isPending || !text.trim() || !jobId}>
                {isPending ? "Reading…" : "Next"}
              </Button>
            </>
          ) : step === "preview" ? (
            <>
              <Button variant="outline" onClick={() => setStep("paste")} disabled={isPending}>
                Back
              </Button>
              <Button onClick={runImport} disabled={isPending || toAdd === 0}>
                {isPending ? "Adding…" : toAdd === 0 ? "Nothing to add" : `Add ${toAdd} candidate${toAdd === 1 ? "" : "s"}`}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
