"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { updateOfferNegotiationAction } from "@/actions/recruitment-offers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FOLLOW_UP_PRESETS,
  NEGOTIATION_STATUS,
  followUpDate,
  isFollowUpOverdue,
} from "@/lib/recruitment/offer/negotiation";

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Sent ⇄ In negotiation for a released offer, with one note and a follow-up
 * date. Accept / Decline stay as the offer's own buttons.
 */
export function OfferNegotiationPanel({
  offer,
}: {
  offer: {
    id: string;
    status: string;
    negotiationStatus?: string | null;
    negotiationNote?: string | null;
    negotiationFollowUpAt?: Date | string | null;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const negotiating = offer.negotiationStatus === NEGOTIATION_STATUS;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(offer.negotiationNote ?? "");
  const [followUp, setFollowUp] = useState(toDateInput(offer.negotiationFollowUpAt));
  const [error, setError] = useState<string | null>(null);
  const overdue = isFollowUpOverdue(offer);

  const save = (inNegotiation: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await updateOfferNegotiationAction(
        {},
        {
          id: offer.id,
          inNegotiation,
          note: inNegotiation ? note : null,
          followUpAt: inNegotiation && followUp ? new Date(`${followUp}T10:00:00`).toISOString() : null,
        }
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const showForm = editing || (negotiating && !offer.negotiationNote && !offer.negotiationFollowUpAt);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Offer status" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {[
            { value: false, label: "Sent" },
            { value: true, label: "In negotiation" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={negotiating === opt.value}
              disabled={isPending}
              onClick={() => {
                if (opt.value === negotiating) return;
                if (opt.value) setEditing(true);
                else save(false);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                negotiating === opt.value || (opt.value && editing)
                  ? opt.value
                    ? "bg-amber-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {negotiating && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-primary hover:underline">
            Update
          </button>
        ) : null}
      </div>

      {negotiating && !showForm ? (
        <div className="space-y-1 text-xs">
          {offer.negotiationNote ? <p className="whitespace-pre-wrap text-foreground">{offer.negotiationNote}</p> : null}
          {offer.negotiationFollowUpAt ? (
            <p className={cn("inline-flex items-center gap-1 font-semibold", overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              <CalendarClock className="h-3.5 w-3.5" />
              Follow up {new Date(offer.negotiationFollowUpAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              {overdue ? " · overdue" : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="What are they asking for? e.g. 6 LPA, joining 15 Nov"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Follow up</span>
            {FOLLOW_UP_PRESETS.map((p) => {
              const value = toDateInput(followUpDate(p.days));
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setFollowUp(value)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    followUp === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/40"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              aria-label="Pick a follow-up date"
              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setEditing(false);
                setNote(offer.negotiationNote ?? "");
                setFollowUp(toDateInput(offer.negotiationFollowUpAt));
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" loading={isPending} onClick={() => save(true)}>
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
