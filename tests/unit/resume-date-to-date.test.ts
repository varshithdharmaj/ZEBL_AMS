import { describe, expect, it } from "vitest";
import { normalizeResumeDate, resumeDateToDate } from "@/lib/recruitment/resume-import/parser/patterns";

describe("resume dates", () => {
  it("reads full numeric dates day-first, falling back to month-first", () => {
    expect(normalizeResumeDate("21/10/2021")).toBe("2021-10-21");
    expect(normalizeResumeDate("05-06-2021")).toBe("2021-06-05");
    expect(normalizeResumeDate("10/21/2021")).toBe("2021-10-21");
    expect(normalizeResumeDate("32/13/2021")).toBeNull();
  });

  it("converts to Date without ever returning an Invalid Date", () => {
    expect(resumeDateToDate("21/10/2021")?.toISOString().slice(0, 10)).toBe("2021-10-21");
    expect(resumeDateToDate("Jan 2022")?.toISOString().slice(0, 10)).toBe("2022-01-01");
    expect(resumeDateToDate("Present")).toBeNull();
    expect(resumeDateToDate("not a date")).toBeNull();
    expect(resumeDateToDate("")).toBeNull();
    expect(resumeDateToDate(null)).toBeNull();
    expect(resumeDateToDate(new Date("invalid"))).toBeNull();
  });
});
