"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createTicketAction, type TicketActionState } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "@/lib/tickets/labels";
import { Info } from "lucide-react";
// import { AlertTriangle, Info } from "lucide-react"; // AlertTriangle used by anonymous UI

const initialState: TicketActionState = {};

const DEFAULT_SUMMARY_PLACEHOLDER = "e.g. Monitor not displaying – HDMI cable issue";
const DEFAULT_DETAILS_HINT = "Include relevant dates, names, or other information that will help us assist you.";

type TicketPreset = {
  category: string;
  type: string;
  subject: string;
  description: string;
  note: string;
};

/** Pre-filled tickets linked from elsewhere in the app, e.g. My Profile → "Request a change". */
const TOPIC_PRESETS = new Map<string, TicketPreset>([
  [
    "statutory-details",
    {
      category: "payroll",
      type: "service_request",
      subject: "Update my bank or statutory details",
      description: "What needs to change (e.g. bank account, IFSC, PAN, UAN, ESI number):\n",
      note: "Don't type full account or ID numbers here. HR will contact you to collect the new details and any proof, such as a cancelled cheque.",
    },
  ],
]);

export function TicketCreateForm({ topic }: { topic?: string }) {
  const preset = topic ? TOPIC_PRESETS.get(topic) : undefined;
  const [state, formAction, pending] = useActionState(createTicketAction, initialState);
  // No default category: a pre-picked one gets submitted unchanged and lands
  // the ticket in the wrong queue. Presets still pick theirs.
  const [category, setCategory] = useState(preset?.category ?? "");
  const [type, setType] = useState(preset?.type ?? "service_request");
  const [priority, setPriority] = useState("medium");
  const [categoryMissing, setCategoryMissing] = useState(false);
  // Anonymous feature temporarily disabled
  // const [isAnonymous, setIsAnonymous] = useState(false);

  const selectedCategory = CATEGORY_OPTIONS.find((c) => c.value === category);
  const selectedPriority = PRIORITY_OPTIONS.find((p) => p.value === priority);

  return (
    <SectionCard
      title="Ticket Details"
      description="Tell us what it's about and what you need. The more specific you are, the faster we can help."
    >
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!category) {
            e.preventDefault();
            setCategoryMissing(true);
          }
        }}
        className="max-w-2xl space-y-6"
      >
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="priority" value={priority} />
        <input type="hidden" name="isAnonymous" value="false" />

        {state.error && <ErrorAlert message={state.error} />}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-category" className="text-xs font-semibold text-slate-700">
              What is it about?
            </Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setCategoryMissing(false);
              }}
            >
              <SelectTrigger
                id="ticket-category"
                aria-invalid={categoryMissing || undefined}
                aria-describedby={categoryMissing ? "ticket-category-error" : undefined}
                className={categoryMissing ? "border-danger" : undefined}
              >
                <SelectValue placeholder="Choose a topic" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value} description={c.hint}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryMissing ? (
              <p id="ticket-category-error" className="text-xs text-danger">
                Choose what your ticket is about.
              </p>
            ) : (
              selectedCategory && <p className="text-xs text-muted-foreground">{selectedCategory.hint}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-type" className="text-xs font-semibold text-slate-700">
              What do you need?
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="ticket-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} description={t.hint}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject" className="text-xs font-semibold text-slate-700">
            Short summary
          </Label>
          <Input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder={selectedCategory?.summaryExample ?? DEFAULT_SUMMARY_PLACEHOLDER}
            minLength={3}
            maxLength={200}
            defaultValue={preset?.subject}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-semibold text-slate-700">
            Details
          </Label>
          <Textarea
            id="description"
            name="description"
            required
            placeholder="Describe the problem or request…"
            rows={6}
            minLength={10}
            maxLength={5000}
            defaultValue={preset?.description}
            aria-describedby="description-hint"
          />
          <p id="description-hint" className="text-xs text-muted-foreground">
            {selectedCategory?.detailsHint ?? DEFAULT_DETAILS_HINT}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ticket-priority" className="text-xs font-semibold text-slate-700">
            How urgent is it?
          </Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="ticket-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value} description={p.hint}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPriority && <p className="text-xs text-muted-foreground">{selectedPriority.hint}</p>}
        </div>

        {/* Anonymous feature temporarily disabled
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="isAnonymous"
              name="isAnonymousCheckbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <Label htmlFor="isAnonymous" className="cursor-pointer text-xs font-semibold text-slate-700">
                Submit as Anonymous Complaint
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Your identity will be hidden
              </p>
            </div>
          </div>

          {isAnonymous && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Important:</strong> Anonymous complaints can only be accessed by Super Admin.
                HR users and HR managers cannot view anonymous complaints or your identity.
              </p>
            </div>
          )}
        </div>
        */}

        {preset && (
          <div className="flex gap-2 rounded-md border border-warning/20 bg-warning-muted p-3 text-xs text-warning">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{preset.note}</p>
          </div>
        )}

        <div className="flex gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            You&apos;ll receive updates via this portal when HR responds to your ticket. Check &quot;My Tickets&quot; regularly for updates.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={pending}>
            {pending ? "Submitting…" : "Submit Ticket"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/employee/tickets">Cancel</Link>
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
