/**
 * Display labels for ticket category enum values. Covers every stored value,
 * including ones no longer offered on the create form, so older tickets still
 * render and stay filterable.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  attendance: "Attendance & Shifts",
  leave: "Leave",
  payroll: "Payroll",
  salary: "Salary",
  it_technical: "IT & Equipment",
  hr: "HR & Documents",
  workplace: "Workplace & Colleagues",
  facilities: "Office & Facilities",
  suggestion: "Suggestion",
  other: "Other",
};

/** Display labels for ticket type enum values (HR-facing views). */
export const TYPE_LABELS: Record<string, string> = {
  service_request: "Service request",
  complaint: "Complaint",
  suggestion: "Suggestion",
  meeting_request: "Meeting request",
  anonymous_complaint: "Anonymous complaint",
  other: "Other",
};

export type TicketCategoryOption = {
  value: string;
  label: string;
  /** What belongs in this category, shown under the option. */
  hint: string;
  /** Example summary for the subject field. */
  summaryExample: string;
  /** What to include in the details, shown under the description field. */
  detailsHint: string;
};

/**
 * Categories an employee can pick when raising a ticket. `salary` and
 * `suggestion` are left out on purpose: salary is covered by Payroll, and
 * suggestions are a ticket type, not a topic.
 */
export const CATEGORY_OPTIONS: TicketCategoryOption[] = [
  {
    value: "it_technical",
    label: CATEGORY_LABELS.it_technical,
    hint: "Laptop, monitor, cables, internet, software, logins",
    summaryExample: "e.g. Monitor not displaying – HDMI cable issue",
    detailsHint: "Which device, what happens, what you've already tried, and your desk or location.",
  },
  {
    value: "attendance",
    label: CATEGORY_LABELS.attendance,
    hint: "Punches, missed check-ins, shift timings",
    summaryExample: "e.g. Check-out missing on 12 Sep",
    detailsHint: "The date(s), your actual in/out times, and what the system shows instead.",
  },
  {
    value: "leave",
    label: CATEGORY_LABELS.leave,
    hint: "Leave balance, applying or cancelling leave",
    summaryExample: "e.g. Casual leave balance looks wrong",
    detailsHint: "The leave type, the dates, and the balance you expected versus what you see.",
  },
  {
    value: "payroll",
    label: CATEGORY_LABELS.payroll,
    hint: "Payslips, salary, deductions, reimbursements",
    summaryExample: "e.g. Unexplained deduction on August payslip",
    detailsHint: "The month, the line item, and the amount. Don't include full bank or ID numbers.",
  },
  {
    value: "hr",
    label: CATEGORY_LABELS.hr,
    hint: "Letters, documents, policies, profile corrections",
    summaryExample: "e.g. Need an experience letter",
    detailsHint: "What you need, what it's for, and by when.",
  },
  {
    value: "facilities",
    label: CATEGORY_LABELS.facilities,
    hint: "AC, seating, cleaning, furniture, office access",
    summaryExample: "e.g. AC not working near my desk",
    detailsHint: "The exact location (floor, bay, desk) and since when it's been a problem.",
  },
  {
    value: "workplace",
    label: CATEGORY_LABELS.workplace,
    hint: "Team concerns, conduct, working environment",
    summaryExample: "e.g. Concern about team communication",
    detailsHint: "What happened, when, and who was involved. Stick to facts; HR will follow up privately.",
  },
  {
    value: "other",
    label: CATEGORY_LABELS.other,
    hint: "Anything that doesn't fit above",
    summaryExample: "e.g. Question about the holiday calendar",
    detailsHint: "Include relevant dates, names, or other information that will help us assist you.",
  },
];

export type TicketChoiceOption = { value: string; label: string; hint: string };

/**
 * Ticket types as an employee chooses them — phrased as what they need.
 * `anonymous_complaint` is omitted while the anonymous feature is disabled.
 */
export const TYPE_OPTIONS: TicketChoiceOption[] = [
  { value: "service_request", label: "Help / fix something", hint: "Something isn't working, or you need something done" },
  { value: "complaint", label: "Raise a complaint", hint: "Report a concern you want HR to look into" },
  { value: "suggestion", label: "Share an idea", hint: "Suggest an improvement" },
  { value: "meeting_request", label: "Meet with HR", hint: "Ask for a conversation with HR" },
  { value: "other", label: "Other", hint: "None of the above" },
];

/** Priorities as an employee chooses them — described by impact. */
export const PRIORITY_OPTIONS: TicketChoiceOption[] = [
  { value: "low", label: "Low", hint: "Can wait, not affecting my work" },
  { value: "medium", label: "Medium", hint: "Slowing me down, but I can still work" },
  { value: "high", label: "High", hint: "I can't do my work until this is fixed" },
];

/** Tailwind class strings for ticket priority badges. */
export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};
