import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  rejectApplicationSchema,
  withdrawApplicationSchema,
} from "@/lib/validation/schemas/recruitment/applications";
import {
  REJECTION_REASONS,
  WITHDRAWAL_REASONS,
  describeCloseReason,
} from "@/lib/recruitment/application/close-reasons";
import {
  CloseReasonSummary,
  getCloseReason,
} from "@/components/recruitment/applications/close-reason-summary";

vi.mock("@/actions/recruitment-applications", () => ({
  rejectApplicationAction: vi.fn(),
  withdrawApplicationAction: vi.fn(),
}));

describe("close reason validation", () => {
  it("accepts a reason code with or without a note", () => {
    expect(rejectApplicationSchema.safeParse({ id: "a", reasonCode: "failed_interview" }).success).toBe(true);
    expect(
      rejectApplicationSchema.safeParse({ id: "a", reasonCode: "failed_interview", note: "Weak SQL" }).success
    ).toBe(true);
  });

  it("requires a reason code from the list", () => {
    expect(rejectApplicationSchema.safeParse({ id: "a" }).success).toBe(false);
    expect(rejectApplicationSchema.safeParse({ id: "a", reasonCode: "vibes" }).success).toBe(false);
  });

  it("keeps reject and withdraw lists separate", () => {
    expect(withdrawApplicationSchema.safeParse({ id: "a", reasonCode: "failed_interview" }).success).toBe(false);
    expect(rejectApplicationSchema.safeParse({ id: "a", reasonCode: "accepted_other_offer" }).success).toBe(false);
  });

  it("requires a note for Other", () => {
    expect(rejectApplicationSchema.safeParse({ id: "a", reasonCode: "other" }).success).toBe(false);
    expect(rejectApplicationSchema.safeParse({ id: "a", reasonCode: "other", note: "   " }).success).toBe(false);
    expect(withdrawApplicationSchema.safeParse({ id: "a", reasonCode: "other", note: "Family" }).success).toBe(true);
  });

  it("turns a blank note into undefined", () => {
    const res = rejectApplicationSchema.parse({ id: "a", reasonCode: "duplicate", note: "  " });
    expect(res.note).toBeUndefined();
  });

  it("offers the agreed reason lists, each ending with Other", () => {
    expect(REJECTION_REASONS).toHaveLength(9);
    expect(WITHDRAWAL_REASONS).toHaveLength(6);
    expect(REJECTION_REASONS.at(-1)?.code).toBe("other");
    expect(WITHDRAWAL_REASONS.at(-1)?.code).toBe("other");
  });
});

describe("close reason display", () => {
  it("describes label and note together, or either alone", () => {
    expect(describeCloseReason("reject", "failed_interview", "Weak SQL")).toBe("Failed interview round — Weak SQL");
    expect(describeCloseReason("reject", "failed_interview", null)).toBe("Failed interview round");
    expect(describeCloseReason("reject", null, "Legacy free text")).toBe("Legacy free text");
    expect(describeCloseReason("reject", null, null)).toBeNull();
  });

  it("ignores open applications", () => {
    expect(getCloseReason({ status: "active", rejectionReasonCode: "duplicate" })).toBeNull();
  });

  it("shows reason, who and when for a rejected application", () => {
    const html = renderToStaticMarkup(
      <CloseReasonSummary
        application={{ status: "rejected", rejectionReasonCode: "failed_interview", rejectedReason: "Weak SQL" }}
        closedBy="Sowmya"
        closedAt="2026-10-01T10:00:00Z"
      />
    );
    expect(html).toContain("Rejected · Failed interview round");
    expect(html).toContain("by Sowmya");
    expect(html).toContain("Weak SQL");
  });

  it("still shows the old free-text reason for applications rejected before codes existed", () => {
    const html = renderToStaticMarkup(
      <CloseReasonSummary application={{ status: "rejected", rejectedReason: "Not a fit" }} />
    );
    expect(html).toContain("Not a fit");
  });

  it("shows withdrawals with the withdrawal list", () => {
    const html = renderToStaticMarkup(
      <CloseReasonSummary application={{ status: "withdrawn", withdrawalReasonCode: "accepted_other_offer" }} />
    );
    expect(html).toContain("Withdrawn · Accepted another offer");
  });
});
