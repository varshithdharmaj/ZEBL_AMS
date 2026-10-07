/**
 * Reads rows copied from HR's Excel sheet (tab-separated, as Excel puts them
 * on the clipboard) into candidate fields. Pure — safe for client imports, so
 * the paste box can show the preview without a round trip.
 *
 * Their sheet's columns, in order:
 *   Sl.no | Name | Email ID | Phone Number | Current Location | Qualification |
 *   Total Experience | Remarks | Availability | Candidate profile
 * A header row is optional; when present, columns are matched by name so a
 * reordered or trimmed sheet still works.
 */

export type PastedField =
  | "slNo"
  | "name"
  | "email"
  | "phone"
  | "location"
  | "qualification"
  | "experience"
  | "remarks"
  | "availability"
  | "profile";

/** Column order of HR's sheet, used when the paste has no header row. */
export const SHEET_COLUMNS: readonly PastedField[] = [
  "slNo",
  "name",
  "email",
  "phone",
  "location",
  "qualification",
  "experience",
  "remarks",
  "availability",
  "profile",
];

export const PASTED_FIELD_LABELS: Record<PastedField, string> = {
  slNo: "Sl.no",
  name: "Name",
  email: "Email ID",
  phone: "Phone Number",
  location: "Current Location",
  qualification: "Qualification",
  experience: "Total Experience",
  remarks: "Remarks",
  availability: "Availability",
  profile: "Candidate profile",
};

const HEADER_MATCHERS: Array<{ field: PastedField; pattern: RegExp }> = [
  { field: "slNo", pattern: /^(sl\.?\s*no\.?|s\.?\s*no\.?|sr\.?\s*no\.?|serial|#)$/ },
  { field: "email", pattern: /e-?mail/ },
  { field: "phone", pattern: /phone|mobile|contact\s*(no|number)?$/ },
  { field: "location", pattern: /location|city/ },
  { field: "qualification", pattern: /qualification|education|degree/ },
  { field: "experience", pattern: /experience|\bexp\b/ },
  { field: "remarks", pattern: /remark|comment|note/ },
  { field: "availability", pattern: /availab|notice|joining/ },
  { field: "profile", pattern: /profile|resume|cv/ },
  { field: "name", pattern: /name/ },
];

export type ParsedRow = {
  /** 1-based line in the pasted text (after the header), for messages. */
  line: number;
  slNo: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  qualification: string | null;
  /** Years, one decimal; null when blank or unreadable. */
  experienceYears: number | null;
  experienceText: string | null;
  remarks: string | null;
  /** Days; 0 for "Immediate"; null when the text isn't a plain period. */
  noticePeriodDays: number | null;
  availabilityText: string | null;
  profile: string | null;
  /** Problems that stop the row from being added. */
  errors: string[];
  /** Things HR should know, but the row is still added. */
  warnings: string[];
};

export type ParsedPaste = {
  hasHeader: boolean;
  /** Which field each pasted column was read as (null = ignored). */
  columns: Array<PastedField | null>;
  rows: ParsedRow[];
};

/**
 * Splits clipboard text into cells. Excel quotes a cell that contains a tab,
 * newline or quote, doubling inner quotes — handle that so multi-line remarks
 * stay in one cell.
 */
export function splitTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function headerField(cell: string): PastedField | null {
  const text = cell.trim().toLowerCase();
  if (!text) return null;
  return HEADER_MATCHERS.find((m) => m.pattern.test(text))?.field ?? null;
}

function looksLikeHeader(cells: string[]): boolean {
  const fields = cells.map(headerField);
  return fields.includes("name") && (fields.includes("email") || fields.includes("phone"));
}

function blankToNull(value: string | undefined): string | null {
  const v = value?.replace(/\s+/g, " ").trim();
  return v ? v : null;
}

/**
 * "3", "3 yrs", "3.5 years", "3+ years", "2 yrs 6 months", "6 months",
 * "Fresher" → years with one decimal. Ranges like "2-3 years" take the lower end.
 */
export function parseExperienceYears(raw: string | null): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase().trim();
  if (/^(fresher|freshers|nil|none|no experience|0)$/.test(text)) return 0;

  const years = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:y|yr|yrs|year|years)\b/);
  const months = text.match(/(\d+(?:\.\d+)?)\s*(?:m|mon|month|months|mos)\b/);
  if (years || months) {
    const total = (years ? Number(years[1]) : 0) + (months ? Number(months[1]) / 12 : 0);
    return Number.isFinite(total) && total <= 60 ? Math.round(total * 10) / 10 : null;
  }

  const bare = text.match(/^(\d+(?:\.\d+)?)\s*\+?$/);
  if (bare) {
    const n = Number(bare[1]);
    return n <= 60 ? Math.round(n * 10) / 10 : null;
  }
  return null;
}

/** "Immediate" → 0, "30 days" → 30, "1 month" → 30, "2 weeks" → 14, "45" → 45. */
export function parseNoticePeriodDays(raw: string | null): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase().trim();
  if (/^immediate|^immediately|^imm\b|^available now|^ready to join/.test(text)) return 0;

  const days = text.match(/^(\d{1,3})\s*(?:d|day|days)?\b/);
  if (days && !/month|week/.test(text)) return Number(days[1]);
  const months = text.match(/^(\d{1,2}(?:\.\d)?)\s*(?:m|mon|month|months)\b/);
  if (months) return Math.round(Number(months[1]) * 30);
  const weeks = text.match(/^(\d{1,2})\s*(?:w|wk|wks|week|weeks)\b/);
  if (weeks) return Number(weeks[1]) * 7;
  return null;
}

/**
 * Indian numbers as HR types them ("98765 43210", "+91-98765-43210",
 * "09876543210") → "+919876543210" style that the candidate form accepts.
 * Returns an error string when it can't be a phone number.
 */
export function cleanPhone(raw: string | null): { phone: string | null; error?: string } {
  if (!raw) return { phone: null };
  const text = raw.trim();
  if (/e\+?\d+$/i.test(text)) {
    return { phone: null, error: "Phone number was shortened by Excel (e.g. 9.88E+09). Format the column as Text and copy again." };
  }
  const hasPlus = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!hasPlus) digits = digits.replace(/^0+/, "");
  if (digits.length === 10) return { phone: digits };
  if (digits.length >= 8 && digits.length <= 15) return { phone: `+${digits}` };
  return { phone: null, error: `"${text}" doesn't look like a phone number.` };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(raw: string | null): { email: string | null; error?: string } {
  if (!raw) return { email: null };
  const email = raw.trim().replace(/^mailto:/i, "").toLowerCase();
  return EMAIL_PATTERN.test(email) ? { email } : { email: null, error: `"${raw.trim()}" isn't a valid email.` };
}

/** Last 10 digits — how the same Indian number is matched with or without +91. */
export function phoneMatchKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-10) : null;
}

export function parsePastedRows(text: string): ParsedPaste {
  const grid = splitTsv(text);
  if (grid.length === 0) return { hasHeader: false, columns: [], rows: [] };

  const hasHeader = looksLikeHeader(grid[0]);
  let columns: Array<PastedField | null>;
  if (hasHeader) {
    const seen = new Set<PastedField>();
    columns = grid[0].map((cell) => {
      const field = headerField(cell);
      if (!field || seen.has(field)) return null;
      seen.add(field);
      return field;
    });
  } else {
    // No header: their sheet order. If the first cell isn't a number the
    // Sl.no column was left out, so shift everything by one.
    const startsWithSlNo = /^\d+\.?$/.test(grid[0][0]?.trim() ?? "");
    columns = (startsWithSlNo ? SHEET_COLUMNS : SHEET_COLUMNS.slice(1)).slice();
  }

  const body = hasHeader ? grid.slice(1) : grid;
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();

  const rows = body.map((cells, index): ParsedRow => {
    const get = (field: PastedField) => {
      const col = columns.indexOf(field);
      return col === -1 ? null : blankToNull(cells[col]);
    };
    const errors: string[] = [];
    const warnings: string[] = [];
    const line = index + 1;

    const name = get("name") ?? "";
    if (name.length < 2) errors.push("Name is missing.");

    const emailResult = cleanEmail(get("email"));
    if (emailResult.error) warnings.push(`${emailResult.error} Email not saved.`);
    const phoneResult = cleanPhone(get("phone"));
    if (phoneResult.error) warnings.push(`${phoneResult.error} Phone not saved.`);
    if (!emailResult.email && !phoneResult.phone && name.length >= 2) {
      warnings.push("No email or phone, so this person can't be matched with an existing candidate.");
    }

    const emailKey = emailResult.email;
    const phoneKey = phoneMatchKey(phoneResult.phone);
    const earlier =
      (emailKey && seenEmails.get(emailKey)) || (phoneKey && seenPhones.get(phoneKey)) || null;
    if (earlier) errors.push(`Same person as row ${earlier} in this paste.`);
    if (emailKey && !seenEmails.has(emailKey)) seenEmails.set(emailKey, line);
    if (phoneKey && !seenPhones.has(phoneKey)) seenPhones.set(phoneKey, line);

    const experienceText = get("experience");
    const experienceYears = parseExperienceYears(experienceText);
    if (experienceText && experienceYears === null) {
      warnings.push(`Experience "${experienceText}" not understood; saved in remarks.`);
    }

    const availabilityText = get("availability");
    const slNoText = get("slNo");
    const slNo = slNoText && /^\d+\.?$/.test(slNoText) ? Number.parseInt(slNoText, 10) : null;

    return {
      line,
      slNo,
      name,
      email: emailResult.email,
      phone: phoneResult.phone,
      location: get("location"),
      qualification: get("qualification"),
      experienceYears,
      experienceText,
      remarks: get("remarks"),
      noticePeriodDays: parseNoticePeriodDays(availabilityText),
      availabilityText,
      profile: get("profile"),
      errors,
      warnings,
    };
  });

  return { hasHeader, columns, rows };
}

/** Remarks to save: HR's remarks plus anything that didn't fit a field. */
export function remarksForRow(row: ParsedRow): string | null {
  const parts = [row.remarks];
  if (row.experienceText && row.experienceYears === null) parts.push(`Experience: ${row.experienceText}`);
  const text = parts.filter(Boolean).join("\n");
  return text || null;
}

export function isLink(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\/\S+$/i.test(value.trim()));
}
