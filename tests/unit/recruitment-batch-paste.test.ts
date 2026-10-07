import { describe, expect, it } from "vitest";
import {
  cleanPhone,
  parseExperienceYears,
  parseNoticePeriodDays,
  parsePastedRows,
  phoneMatchKey,
  remarksForRow,
  splitTsv,
} from "@/lib/recruitment/batch/parse-pasted-rows";
import { nextBatchCode } from "@/lib/recruitment/batch/batch-code";
import { batchBucket, countProgress } from "@/lib/recruitment/batch/batch-progress";

const HEADER =
  "Sl.no\tName\tEmail ID\tPhone Number\tCurrent Location\tQualification\tTotal Experience\tRemarks\tAvailability\tCandidate profile";

describe("splitTsv", () => {
  it("keeps a quoted multi-line Excel cell in one cell", () => {
    const grid = splitTsv('1\tRavi\t"Good comms\nCall after 5"\tImmediate\r\n2\tSita\t\t30 days\r\n');
    expect(grid).toEqual([
      ["1", "Ravi", "Good comms\nCall after 5", "Immediate"],
      ["2", "Sita", "", "30 days"],
    ]);
  });

  it("drops blank lines", () => {
    expect(splitTsv("\n\t\t\nA\tB\n\n")).toEqual([["A", "B"]]);
  });
});

describe("parseExperienceYears", () => {
  it.each([
    ["3", 3],
    ["3 yrs", 3],
    ["3.5 years", 3.5],
    ["3+ years", 3],
    ["2-3 years", 2],
    ["2 yrs 6 months", 2.5],
    ["6 months", 0.5],
    ["Fresher", 0],
    ["1.5yrs", 1.5],
  ])("%s → %s", (input, expected) => {
    expect(parseExperienceYears(input)).toBe(expected);
  });

  it("returns null for text it can't read", () => {
    expect(parseExperienceYears("worked at Infosys")).toBeNull();
    expect(parseExperienceYears(null)).toBeNull();
  });
});

describe("parseNoticePeriodDays", () => {
  it.each([
    ["Immediate", 0],
    ["Immediate joiner", 0],
    ["30 days", 30],
    ["15 days notice", 15],
    ["45", 45],
    ["1 month", 30],
    ["2 months", 60],
    ["2 weeks", 14],
  ])("%s → %s", (input, expected) => {
    expect(parseNoticePeriodDays(input)).toBe(expected);
  });

  it("keeps free text as text only", () => {
    expect(parseNoticePeriodDays("Serving notice, LWD 20 Oct")).toBeNull();
  });
});

describe("cleanPhone", () => {
  it("normalises the ways HR types Indian numbers", () => {
    expect(cleanPhone("98765 43210").phone).toBe("9876543210");
    expect(cleanPhone("09876543210").phone).toBe("9876543210");
    expect(cleanPhone("+91-98765-43210").phone).toBe("+919876543210");
    expect(cleanPhone("919876543210").phone).toBe("+919876543210");
  });

  it("flags numbers Excel turned into scientific notation", () => {
    const res = cleanPhone("9.88E+09");
    expect(res.phone).toBeNull();
    expect(res.error).toMatch(/shortened by Excel/);
  });

  it("matches the same number with or without +91", () => {
    expect(phoneMatchKey("+919876543210")).toBe(phoneMatchKey("9876543210"));
  });
});

describe("parsePastedRows", () => {
  it("reads HR's sheet with its header row", () => {
    const text = [
      HEADER,
      "1\tAkula Sravanthi\tAkula@Gmail.com\t98765 43210\tHyderabad\tB.Pharm\t2 yrs\tGood communication\tImmediate\thttps://drive.google.com/x",
      "2\tM. Pratibha\t\t9123456780\tVizag\tPharm.D\tFresher\t\t30 days\t",
    ].join("\n");
    const parsed = parsePastedRows(text);
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      line: 1,
      slNo: 1,
      name: "Akula Sravanthi",
      email: "akula@gmail.com",
      phone: "9876543210",
      location: "Hyderabad",
      qualification: "B.Pharm",
      experienceYears: 2,
      remarks: "Good communication",
      noticePeriodDays: 0,
      availabilityText: "Immediate",
      profile: "https://drive.google.com/x",
      errors: [],
    });
    expect(parsed.rows[1]).toMatchObject({ email: null, experienceYears: 0, noticePeriodDays: 30, profile: null });
  });

  it("matches columns by header name when the sheet is reordered", () => {
    const parsed = parsePastedRows("Phone Number\tName\tTotal Experience\n9876543210\tRavi Kumar\t4");
    expect(parsed.rows[0]).toMatchObject({ name: "Ravi Kumar", phone: "9876543210", experienceYears: 4 });
  });

  it("uses the sheet order without a header, with or without Sl.no", () => {
    const withSlNo = parsePastedRows("7\tRavi Kumar\travi@x.com\t9876543210\tPune");
    expect(withSlNo.hasHeader).toBe(false);
    expect(withSlNo.rows[0]).toMatchObject({ slNo: 7, name: "Ravi Kumar", email: "ravi@x.com", location: "Pune" });

    const withoutSlNo = parsePastedRows("Ravi Kumar\travi@x.com\t9876543210\tPune");
    expect(withoutSlNo.rows[0]).toMatchObject({ slNo: null, name: "Ravi Kumar", email: "ravi@x.com", location: "Pune" });
  });

  it("stops rows with no name and repeats within the paste", () => {
    const parsed = parsePastedRows(
      [HEADER, "1\t\ta@x.com", "2\tRavi\tr@x.com\t9876543210", "3\tRavi K\t\t+91 98765 43210"].join("\n")
    );
    expect(parsed.rows[0].errors).toContain("Name is missing.");
    expect(parsed.rows[1].errors).toEqual([]);
    expect(parsed.rows[2].errors).toEqual(["Same person as row 2 in this paste."]);
  });

  it("warns about bad emails and keeps the row", () => {
    const parsed = parsePastedRows(`${HEADER}\n1\tRavi\tnot-an-email\t9876543210`);
    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0].email).toBeNull();
    expect(parsed.rows[0].warnings[0]).toMatch(/isn't a valid email/);
  });

  it("keeps unreadable experience in remarks so nothing is lost", () => {
    const [row] = parsePastedRows(`${HEADER}\n1\tRavi\t\t9876543210\t\t\tInfosys + TCS\tCalled twice`).rows;
    expect(row.experienceYears).toBeNull();
    expect(remarksForRow(row)).toBe("Called twice\nExperience: Infosys + TCS");
  });
});

describe("nextBatchCode", () => {
  it("counts up within the year and starts at 001", () => {
    expect(nextBatchCode([], 2026)).toBe("B-2026-001");
    expect(nextBatchCode(["B-2026-001", "B-2026-009", "B-2025-120"], 2026)).toBe("B-2026-010");
    expect(nextBatchCode(["B-2026-999"], 2026)).toBe("B-2026-1000");
  });
});

describe("batch progress", () => {
  it("puts closed applications in their own bucket whatever stage they stopped at", () => {
    expect(batchBucket("manager_round", "rejected")).toBe("rejected");
    expect(batchBucket("hr_round", "on_hold")).toBe("on_hold");
    expect(batchBucket("hr_round", "active")).toBe("hr_round");
    expect(batchBucket("custom_3", "active")).toBe("other_round");
    expect(batchBucket("decision", "active")).toBe("selected");
  });

  it("counts a batch", () => {
    const progress = countProgress([
      { stage: "hr_round", status: "active" },
      { stage: "hr_round", status: "active" },
      { stage: "resume_received", status: "active" },
      { stage: "manager_round", status: "rejected" },
    ]);
    expect(progress).toMatchObject({ hr_round: 2, new: 1, rejected: 1, manager_round: 0 });
  });
});
