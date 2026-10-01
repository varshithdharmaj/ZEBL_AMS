import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  TYPE_LABELS,
  TYPE_OPTIONS,
} from "@/lib/tickets/labels";
import {
  createTicketSchema,
  ticketCategorySchema,
  ticketPrioritySchema,
  ticketTypeSchema,
} from "@/lib/validation/schemas/tickets";

describe("ticket labels", () => {
  it("labels every stored category and type, including ones no longer offered", () => {
    for (const value of ticketCategorySchema.options) expect(CATEGORY_LABELS[value]).toBeTruthy();
    for (const value of ticketTypeSchema.options) expect(TYPE_LABELS[value]).toBeTruthy();
  });

  it("only offers values the schema accepts", () => {
    for (const o of CATEGORY_OPTIONS) expect(ticketCategorySchema.options).toContain(o.value);
    for (const o of TYPE_OPTIONS) expect(ticketTypeSchema.options).toContain(o.value);
    expect(PRIORITY_OPTIONS.map((o) => o.value)).toEqual(ticketPrioritySchema.options);
  });

  it("hides duplicate categories and the disabled anonymous type from the create form", () => {
    const categories = CATEGORY_OPTIONS.map((o) => o.value);
    expect(categories).not.toContain("salary");
    expect(categories).not.toContain("suggestion");
    expect(TYPE_OPTIONS.map((o) => o.value)).not.toContain("anonymous_complaint");
  });

  it("gives every offered category a hint, summary example and details hint", () => {
    for (const o of CATEGORY_OPTIONS) {
      expect(o.hint).toBeTruthy();
      expect(o.summaryExample).toBeTruthy();
      expect(o.detailsHint).toBeTruthy();
    }
  });
});

describe("example scenario: monitor not working (HDMI cable / CPU port)", () => {
  const it_ = CATEGORY_OPTIONS.find((o) => o.value === "it_technical")!;

  it("is discoverable under IT & Equipment by its hint", () => {
    expect(it_.label).toBe("IT & Equipment");
    expect(it_.hint.toLowerCase()).toContain("monitor");
    expect(it_.hint.toLowerCase()).toContain("cable");
  });

  it("submits as it_technical / service_request / medium", () => {
    const result = createTicketSchema.safeParse({
      category: "it_technical",
      type: "service_request",
      priority: "medium",
      subject: "Second monitor not displaying – HDMI cable/CPU port",
      description:
        "One of my two monitors shows no signal. I re-plugged the HDMI cable at both ends; still nothing. Desk 4B-12.",
      isAnonymous: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a ticket with no topic chosen, with a readable message", () => {
    const result = createTicketSchema.safeParse({
      category: "",
      type: "service_request",
      priority: "medium",
      subject: "Monitor not working",
      description: "No signal on my second monitor.",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose what your ticket is about.");
  });
});
