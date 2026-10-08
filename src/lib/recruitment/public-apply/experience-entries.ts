import { normalizeResumeDate } from "@/lib/recruitment/resume-import/parser/patterns";

/**
 * Experience on the public apply form is entered per company, with one or
 * more roles (and their dates) under each — but stored as the flat
 * company + title rows the review payload already uses. Pure helpers only, so
 * the client form and unit tests share them.
 */

/** month is "01"–"12", year four digits; "" while unset. */
export type YearMonth = { month: string; year: string };

/** One row of the review payload's `experiences` array. */
export type ExperienceRow = {
  company: string;
  title: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  sortOrder?: number;
};

export type RoleEntry = {
  id: string;
  title: string;
  start: YearMonth;
  end: YearMonth;
  isCurrent: boolean;
  /** Parser-only details the form doesn't show, carried through to the saved row. */
  location: string | null;
  description: string | null;
};

export type CompanyEntry = { id: string; company: string; roles: RoleEntry[] };

export const EMPTY_YEAR_MONTH: YearMonth = { month: "", year: "" };

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let idCounter = 0;
function newEntryId(): string {
  idCounter += 1;
  return `exp-${idCounter}`;
}

export function newRole(): RoleEntry {
  return {
    id: newEntryId(),
    title: "",
    start: EMPTY_YEAR_MONTH,
    end: EMPTY_YEAR_MONTH,
    isCurrent: false,
    location: null,
    description: null,
  };
}

export function newCompany(): CompanyEntry {
  return { id: newEntryId(), company: "", roles: [newRole()] };
}

/** Resume date text ("Jan 2021", "03/2020", "2021-05") → month/year selects. */
export function toYearMonth(raw: string | null | undefined): YearMonth {
  const value = raw?.trim();
  if (!value) return EMPTY_YEAR_MONTH;
  // A bare year must not become a made-up January — leave the month for the candidate.
  if (/^\d{4}$/.test(value)) return { month: "", year: value };
  const iso = normalizeResumeDate(value);
  return iso ? { month: iso.slice(5, 7), year: iso.slice(0, 4) } : EMPTY_YEAR_MONTH;
}

function toDateString({ month, year }: YearMonth): string | null {
  return month && year ? `${year}-${month}` : null;
}

const CURRENT_END_PATTERN = /present|current|now|ongoing|till\s*date|to\s*date/i;

/** Flat parsed rows → companies holding their roles (same name, case-insensitive). */
export function groupExperiences(rows: ExperienceRow[]): CompanyEntry[] {
  const byName = new Map<string, CompanyEntry>();
  for (const row of rows) {
    const name = row.company?.trim() ?? "";
    let company = byName.get(name.toLowerCase());
    if (!company) {
      company = { id: newEntryId(), company: name, roles: [] };
      byName.set(name.toLowerCase(), company);
    }
    const isCurrent = Boolean(row.isCurrent) || CURRENT_END_PATTERN.test(row.endDate ?? "");
    company.roles.push({
      id: newEntryId(),
      title: row.title?.trim() ?? "",
      start: toYearMonth(row.startDate),
      end: isCurrent ? EMPTY_YEAR_MONTH : toYearMonth(row.endDate),
      isCurrent,
      location: row.location ?? null,
      description: row.description ?? null,
    });
  }
  return [...byName.values()];
}

/** Companies → the flat rows the server stores, one per role. */
export function flattenCompanies(companies: CompanyEntry[]): ExperienceRow[] {
  return companies
    .flatMap((company) =>
      company.roles.map((role) => ({
        company: company.company.trim(),
        title: role.title.trim(),
        location: role.location,
        description: role.description,
        startDate: toDateString(role.start),
        endDate: role.isCurrent ? null : toDateString(role.end),
        isCurrent: role.isCurrent,
      }))
    )
    .map((row, sortOrder) => ({ ...row, sortOrder }));
}

const roleIsBlank = (role: RoleEntry) =>
  !role.title.trim() && !role.start.month && !role.start.year && !role.end.month && !role.end.year && !role.isCurrent;

/** An untouched company card — dropped on save rather than flagged. */
export const companyIsBlank = (company: CompanyEntry) => !company.company.trim() && company.roles.every(roleIsBlank);

function monthIndex({ month, year }: YearMonth): number | null {
  if (!month || !year) return null;
  return Number(year) * 12 + Number(month) - 1;
}

function currentMonthIndex(now: Date): number {
  return now.getFullYear() * 12 + now.getMonth();
}

export function companyProblem(company: CompanyEntry): string | null {
  if (!company.company.trim()) return "Add the company name.";
  if (company.roles.length === 0) return "Add at least one role at this company.";
  return null;
}

export function roleProblem(role: RoleEntry, now: Date): string | null {
  if (!role.title.trim()) return "Add the role (job title).";
  const start = monthIndex(role.start);
  if (start === null) return "Add the month and year you started.";
  const nowIndex = currentMonthIndex(now);
  if (start > nowIndex) return "The start date can't be in the future.";
  if (role.isCurrent) return null;
  const end = monthIndex(role.end);
  if (end === null) return "Add the month and year you left, or tick “I currently work in this role”.";
  if (end < start) return "The end date is before the start date.";
  if (end > nowIndex) return "The end date can't be in the future. If you still work here, tick “I currently work in this role”.";
  return null;
}

export function experienceHasProblems(companies: CompanyEntry[], now: Date): boolean {
  return companies
    .filter((company) => !companyIsBlank(company))
    .some((company) => companyProblem(company) !== null || company.roles.some((role) => roleProblem(role, now) !== null));
}

/** Inclusive [start, end] month span, or null until the role's dates are complete and in order. */
function roleSpan(role: RoleEntry, now: Date): [number, number] | null {
  const start = monthIndex(role.start);
  const end = role.isCurrent ? currentMonthIndex(now) : monthIndex(role.end);
  if (start === null || end === null || end < start) return null;
  return [start, end];
}

/** Months covered, counting overlaps (two jobs at once, roles sharing a month) only once. */
function coveredMonths(spans: [number, number][]): number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [start, end] of sorted) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) total += current[1] - current[0] + 1;
      current = [start, end];
    }
  }
  if (current) total += current[1] - current[0] + 1;
  return total;
}

const isSpan = (span: [number, number] | null): span is [number, number] => span !== null;

export function roleMonths(role: RoleEntry, now: Date): number {
  const span = roleSpan(role, now);
  return span ? span[1] - span[0] + 1 : 0;
}

export function companyMonths(company: CompanyEntry, now: Date): number {
  return coveredMonths(company.roles.map((role) => roleSpan(role, now)).filter(isSpan));
}

export function totalExperienceMonths(companies: CompanyEntry[], now: Date): number {
  return coveredMonths(companies.flatMap((company) => company.roles.map((role) => roleSpan(role, now))).filter(isSpan));
}

/** 27 → "2 yrs 3 mos" */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} mo${rest === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 mos";
}

/** 50 → "4.2" — the format of the free-text "total experience (years)" field. */
export function monthsToYears(months: number): string {
  return String(Math.round((months / 12) * 10) / 10);
}

export function formatYearMonth({ month, year }: YearMonth): string {
  return month && year ? `${MONTH_NAMES[Number(month) - 1]} ${year}` : year;
}
