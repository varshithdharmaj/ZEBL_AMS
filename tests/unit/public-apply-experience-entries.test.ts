import { describe, expect, it } from "vitest";
import {
  companyIsBlank,
  companyMonths,
  experienceHasProblems,
  flattenCompanies,
  formatDuration,
  groupExperiences,
  monthsToYears,
  newCompany,
  roleMonths,
  roleProblem,
  toYearMonth,
  totalExperienceMonths,
  type CompanyEntry,
  type RoleEntry,
} from "@/lib/recruitment/public-apply/experience-entries";
import { resumeDateToDate } from "@/lib/recruitment/resume-import/parser/patterns";

const NOW = new Date(2026, 9, 5); // Oct 2026

function role(patch: Partial<RoleEntry>): RoleEntry {
  return {
    id: Math.random().toString(36),
    title: "Engineer",
    start: { month: "01", year: "2020" },
    end: { month: "12", year: "2020" },
    isCurrent: false,
    location: null,
    description: null,
    ...patch,
  };
}

function company(name: string, roles: RoleEntry[]): CompanyEntry {
  return { id: name, company: name, roles };
}

describe("toYearMonth", () => {
  it("reads common resume date formats", () => {
    expect(toYearMonth("Jan 2021")).toEqual({ month: "01", year: "2021" });
    expect(toYearMonth("03/2020")).toEqual({ month: "03", year: "2020" });
    expect(toYearMonth("2019-11")).toEqual({ month: "11", year: "2019" });
  });

  it("keeps a bare year without inventing a month", () => {
    expect(toYearMonth("2018")).toEqual({ month: "", year: "2018" });
  });

  it("returns blanks for missing or unreadable dates", () => {
    expect(toYearMonth(null)).toEqual({ month: "", year: "" });
    expect(toYearMonth("sometime")).toEqual({ month: "", year: "" });
  });
});

describe("groupExperiences / flattenCompanies", () => {
  it("groups roles under the same company (case-insensitive) and keeps first-seen order", () => {
    const groups = groupExperiences([
      { company: "Acme", title: "Senior Engineer", startDate: "Jan 2023", endDate: "Present" },
      { company: "Globex", title: "Engineer", startDate: "Jun 2018", endDate: "Dec 2019" },
      { company: "acme ", title: "Engineer", startDate: "Feb 2020", endDate: "Dec 2022" },
    ]);
    expect(groups.map((g) => g.company)).toEqual(["Acme", "Globex"]);
    expect(groups[0]!.roles.map((r) => r.title)).toEqual(["Senior Engineer", "Engineer"]);
    // "Present" end text marks the role current even without the parser's flag.
    expect(groups[0]!.roles[0]!.isCurrent).toBe(true);
  });

  it("flattens back to one stored row per role with YYYY-MM dates", () => {
    const rows = flattenCompanies([
      company(" Acme ", [
        role({ title: "Lead", start: { month: "01", year: "2023" }, isCurrent: true }),
        role({ title: "Engineer", start: { month: "02", year: "2020" }, end: { month: "12", year: "2022" } }),
      ]),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ company: "Acme", title: "Lead", startDate: "2023-01", endDate: null, isCurrent: true, sortOrder: 0 }),
      expect.objectContaining({ company: "Acme", title: "Engineer", startDate: "2020-02", endDate: "2022-12", sortOrder: 1 }),
    ]);
    // Submit turns these strings into the candidate's experience dates.
    expect(resumeDateToDate(rows[1]!.startDate)?.getFullYear()).toBe(2020);
    expect(resumeDateToDate(rows[1]!.startDate)?.getMonth()).toBe(1);
  });
});

describe("durations", () => {
  it("counts months inclusively per role", () => {
    expect(roleMonths(role({ start: { month: "01", year: "2020" }, end: { month: "12", year: "2020" } }), NOW)).toBe(12);
    expect(roleMonths(role({ start: { month: "01", year: "2026" }, isCurrent: true }), NOW)).toBe(10);
  });

  it("counts overlapping roles at a company once", () => {
    const acme = company("Acme", [
      role({ start: { month: "01", year: "2020" }, end: { month: "12", year: "2021" } }), // 24
      role({ start: { month: "06", year: "2021" }, end: { month: "06", year: "2022" } }), // overlaps Jun–Dec 2021
    ]);
    expect(companyMonths(acme, NOW)).toBe(30); // Jan 2020 – Jun 2022
  });

  it("totals across companies without double-counting parallel jobs", () => {
    const companies = [
      company("Acme", [role({ start: { month: "01", year: "2020" }, end: { month: "12", year: "2020" } })]),
      company("Side gig", [role({ start: { month: "07", year: "2020" }, end: { month: "06", year: "2021" } })]),
    ];
    expect(totalExperienceMonths(companies, NOW)).toBe(18); // Jan 2020 – Jun 2021
  });

  it("ignores roles whose dates are incomplete", () => {
    expect(totalExperienceMonths([company("Acme", [role({ end: { month: "", year: "" } })])], NOW)).toBe(0);
  });

  it("formats durations and years", () => {
    expect(formatDuration(27)).toBe("2 yrs 3 mos");
    expect(formatDuration(12)).toBe("1 yr");
    expect(formatDuration(1)).toBe("1 mo");
    expect(monthsToYears(50)).toBe("4.2");
    expect(monthsToYears(48)).toBe("4");
  });
});

describe("validation", () => {
  it("flags missing role details", () => {
    expect(roleProblem(role({ title: " " }), NOW)).toMatch(/job title/);
    expect(roleProblem(role({ start: { month: "", year: "2020" } }), NOW)).toMatch(/started/);
    expect(roleProblem(role({ end: { month: "", year: "" } }), NOW)).toMatch(/currently work/);
    expect(roleProblem(role({ start: { month: "05", year: "2021" }, end: { month: "01", year: "2021" } }), NOW)).toMatch(
      /before the start/
    );
    expect(roleProblem(role({ start: { month: "11", year: "2026" }, isCurrent: true }), NOW)).toMatch(/future/);
    expect(roleProblem(role({}), NOW)).toBeNull();
  });

  it("drops untouched company cards instead of flagging them", () => {
    expect(companyIsBlank(newCompany())).toBe(true);
    expect(experienceHasProblems([newCompany()], NOW)).toBe(false);
    expect(experienceHasProblems([company("", [role({})])], NOW)).toBe(true);
  });
});
