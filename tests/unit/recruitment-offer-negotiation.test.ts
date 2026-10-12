import { describe, expect, it } from "vitest";
import { declineOfferSchema } from "@/lib/validation/schemas/recruitment/offers";
import {
  OFFER_DECLINE_REASONS,
  followUpDate,
  isFollowUpOverdue,
  offerDeclineReasonLabel,
  offerStageLabel,
} from "@/lib/recruitment/offer/negotiation";

describe("offer tracking labels", () => {
  it("shows Sent / In negotiation for a released offer", () => {
    expect(offerStageLabel({ status: "released" })).toBe("Sent");
    expect(offerStageLabel({ status: "released", negotiationStatus: "in_negotiation" })).toBe("In negotiation");
    expect(offerStageLabel({ status: "accepted", negotiationStatus: "in_negotiation" })).toBe("Accepted");
    expect(offerStageLabel({ status: "declined" })).toBe("Declined");
  });

  it("flags overdue follow-ups only while negotiating", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const past = "2026-10-04T10:00:00Z";
    expect(isFollowUpOverdue({ status: "released", negotiationStatus: "in_negotiation", negotiationFollowUpAt: past }, now)).toBe(true);
    expect(isFollowUpOverdue({ status: "released", negotiationStatus: "in_negotiation", negotiationFollowUpAt: "2026-10-06T10:00:00Z" }, now)).toBe(false);
    expect(isFollowUpOverdue({ status: "accepted", negotiationStatus: "in_negotiation", negotiationFollowUpAt: past }, now)).toBe(false);
  });

  it("puts follow-ups at 10am the chosen number of days out", () => {
    const d = followUpDate(3, new Date(2026, 9, 2, 18, 45));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([5, 10, 0]);
  });
});

describe("offer decline reasons", () => {
  it("requires a reason from the list; Other needs a note", () => {
    expect(declineOfferSchema.safeParse({ id: "o1" }).success).toBe(false);
    expect(declineOfferSchema.safeParse({ id: "o1", reasonCode: "salary" }).success).toBe(true);
    expect(declineOfferSchema.safeParse({ id: "o1", reasonCode: "other" }).success).toBe(false);
    expect(declineOfferSchema.safeParse({ id: "o1", reasonCode: "other", reason: "Family" }).success).toBe(true);
  });

  it("labels each reason and ends with Other", () => {
    expect(offerDeclineReasonLabel("counter_offer")).toBe("Counter-offer from current employer");
    expect(OFFER_DECLINE_REASONS.at(-1)?.code).toBe("other");
  });
});
