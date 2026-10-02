/**
 * Simple offer tracking for a small team: an offer is Sent → In negotiation
 * → Accepted / Declined. Negotiation is a flag on a released offer with one
 * note and a follow-up date; declines get a reason from a fixed list so we
 * can see why offers are lost. Client-safe.
 */

export const NEGOTIATION_STATUS = "in_negotiation" as const;

export const OFFER_DECLINE_REASONS = [
  { code: "salary", label: "Salary / compensation" },
  { code: "counter_offer", label: "Counter-offer from current employer" },
  { code: "other_offer", label: "Accepted another offer" },
  { code: "location", label: "Location / relocation" },
  { code: "joining_date", label: "Notice period / joining date" },
  { code: "role", label: "Role or growth concerns" },
  { code: "personal", label: "Personal reasons" },
  { code: "no_response", label: "Stopped responding" },
  { code: "other", label: "Other" },
] as const;

export type OfferDeclineReasonCode = (typeof OFFER_DECLINE_REASONS)[number]["code"];

export const OFFER_DECLINE_REASON_CODES = OFFER_DECLINE_REASONS.map((r) => r.code) as [
  OfferDeclineReasonCode,
  ...OfferDeclineReasonCode[],
];

export function offerDeclineReasonLabel(code: string | null | undefined): string | null {
  return OFFER_DECLINE_REASONS.find((r) => r.code === code)?.label ?? null;
}

/** One-tap follow-up choices: days from today. */
export const FOLLOW_UP_PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In a week", days: 7 },
] as const;

/** 10:00 local time `days` from now — a sensible "call them back" time. */
export function followUpDate(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}

export type OfferTrackingView = {
  status: string;
  negotiationStatus?: string | null;
  negotiationFollowUpAt?: Date | string | null;
};

/** What HR should see for an offer: "Sent", "In negotiation", "Accepted", ... */
export function offerStageLabel(offer: OfferTrackingView): string {
  if (offer.status === "released") {
    return offer.negotiationStatus === NEGOTIATION_STATUS ? "In negotiation" : "Sent";
  }
  return offer.status.charAt(0).toUpperCase() + offer.status.slice(1).replace(/_/g, " ");
}

/** True when a negotiating offer's follow-up date has passed. */
export function isFollowUpOverdue(offer: OfferTrackingView, now: Date = new Date()): boolean {
  if (offer.status !== "released" || offer.negotiationStatus !== NEGOTIATION_STATUS) return false;
  if (!offer.negotiationFollowUpAt) return false;
  return new Date(offer.negotiationFollowUpAt).getTime() < now.getTime();
}
