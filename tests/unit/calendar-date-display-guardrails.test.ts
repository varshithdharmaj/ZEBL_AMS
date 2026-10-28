import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDate, toUtcDateInputValue } from "@/lib/utils";

const root = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

/** UTC-midnight Sept 6 — the employee-416 joining contract. */
const SEPT_6_UTC = new Date("2026-09-06T00:00:00.000Z");

describe("calendar date display — fixed surfaces must stay unambiguous", () => {
  const fixedFiles = [
    "src/components/admin/employee-profile/basic-info-tab.tsx",
    "src/components/recruitment/offers/offer-form.tsx",
    "src/components/recruitment/conversions/employee-preview-card.tsx",
    "src/lib/recruitment/services/employee-conversion-service.ts",
  ] as const;

  it.each(fixedFiles)("%s uses toUtcDateInputValue and/or Shown-as formatDate", (file) => {
    const src = readSrc(file);
    const usesHelper =
      src.includes("toUtcDateInputValue") || src.includes("Shown as {formatDate");
    expect(usesHelper, `${file} lost the safe calendar-date helper/hint`).toBe(true);
    expect(src).not.toMatch(/joiningDate[\s\S]{0,80}toISOString\(\)\.(split|slice)/);
  });

  it("formatDate never looks like US MM/DD for Sept 6", () => {
    expect(toUtcDateInputValue(SEPT_6_UTC)).toBe("2026-09-06");
    const label = formatDate(SEPT_6_UTC);
    expect(label).toContain("Sept");
    expect(label).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    expect(label).not.toMatch(/Jun/);
  });

  it("documents why bare toLocaleDateString is ambiguous for joining dates", () => {
    const us = SEPT_6_UTC.toLocaleDateString("en-US");
    const indiaNumeric = SEPT_6_UTC.toLocaleDateString("en-IN");
    expect(us).toMatch(/9\/6\/2026|6\/9\/2026/);
    expect(indiaNumeric === us || indiaNumeric.includes("/") || indiaNumeric.includes("-")).toBe(true);
    expect(formatDate(SEPT_6_UTC)).toContain("06 Sept 2026");
  });
});

describe("calendar date display — remaining hotspots still using risky patterns", () => {
  const remainingUtcSliceDateInputs = [
    "src/components/recruitment/candidates/candidate-form.tsx",
    "src/components/recruitment/jobs/job-opening-form.tsx",
    "src/components/admin/employee-profile/leave-history-tab.tsx",
  ] as const;

  const remainingAmbiguousJoiningReadouts = [
    "src/components/recruitment/conversions/conversion-summary-card.tsx",
    "src/components/recruitment/applications/application-detail.tsx",
  ] as const;

  it.each(remainingUtcSliceDateInputs)("%s still has local toISOString date-input helper (follow-up)", (file) => {
    const src = readSrc(file);
    expect(src).toMatch(/toISOString\(\)\.(slice|split)\(/);
    expect(src.includes("toUtcDateInputValue")).toBe(false);
  });

  it.each(remainingAmbiguousJoiningReadouts)(
    "%s still formats joining with bare toLocaleDateString (follow-up)",
    (file) => {
      const src = readSrc(file);
      expect(src).toMatch(/joiningDate[\s\S]{0,120}toLocaleDateString\(/);
    }
  );
});
