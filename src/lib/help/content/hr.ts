import type { HelpChapter } from "@/lib/help/types";

export const hrHelpChapters: HelpChapter[] = [
  {
    number: "01",
    title: "Getting Started",
    intro: "Signing in to the admin workspace and how it's laid out.",
    blocks: [
      {
        type: "paragraph",
        text: "This guide covers the HR role in ZEBL AMS — full workforce administration through the admin workspace, shared with the Super Admin role but without platform-level user/role management.",
      },
      { type: "sectionHeading", text: "Signing in" },
      {
        type: "paragraph",
        text: "Sign in with your work email and password, or Sign in with Microsoft if Entra ID is connected. You land on the HR Command Center at `/admin/dashboard`.",
      },
      { type: "sectionHeading", text: "How the admin workspace is organized" },
      {
        type: "paragraph",
        text: "The left-hand menu groups everything into: Core Workforce (Chapters 3–8), Hiring Workspace (Chapter 9, if recruitment is enabled for your organization), System Operations (Chapter 10), Security (Chapter 11), and Settings (Chapter 12). If you're personally linked to an employee record, you'll also see My Workspace (Chapter 13).",
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "You will not see a \"Platform Administration\" group — that's exclusive to Super Admin. See Chapter 14 for exactly where the line sits.",
      },
    ],
  },
  {
    number: "02",
    title: "The HR Command Center",
    intro: "Your dashboard — organization-wide, at a glance.",
    blocks: [
      {
        type: "paragraph",
        text: "Your dashboard (`/admin/dashboard`) is the executive view of the whole organization: headcount, attendance and leave snapshots, and pending approvals, all in one place.",
      },
      {
        type: "paragraph",
        text: "Use it as your daily starting point — it surfaces what needs attention today before you drill into a specific module.",
      },
    ],
  },
  {
    number: "03",
    title: "Employees",
    intro: "The directory and full employee profile.",
    blocks: [
      { type: "paragraph", text: "Employees (`/admin/employees`) is the organization's people directory." },
      { type: "sectionHeading", text: "Browsing and searching" },
      { type: "paragraph", text: "Search or filter the full employee list, then open any record to reach the individual profile." },
      { type: "sectionHeading", text: "Employee profile — `/admin/employees/[id]`" },
      {
        type: "paragraph",
        text: "A full detail view: identity, an attendance summary that's date-range filterable, leave balances and history, and manager-assignment — pick who this person reports to, which is what drives their manager's \"My Team\" view.",
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Setting the manager assignment correctly here is the single most important step for the approval workflow and team-scoped views to work as expected.",
      },
    ],
  },
  {
    number: "04",
    title: "Attendance & Regularization",
    intro: "The daily register and the correction-request queue.",
    blocks: [
      {
        type: "paragraph",
        text: "Two connected screens: the org-wide register, and the queue of correction requests waiting on your decision.",
      },
      { type: "sectionHeading", text: "Attendance register — `/admin/attendance`" },
      {
        type: "paragraph",
        text: "Search and filter every employee's daily attendance by date, payroll period, shift, shortfall, or overtime. Results are paginated, and days with an active regularization request are flagged.",
      },
      { type: "sectionHeading", text: "Regularization queue — `/admin/attendance/regularization`" },
      {
        type: "paragraph",
        text: "Every correction request an employee has submitted against their own punch record, organized into Pending, Approved, Rejected, and Cancelled tabs.",
      },
      {
        type: "steps",
        items: [
          "Open a pending request to see the employee's stated reason next to the original raw punch record.",
          "Approve or reject. Approving applies a correction overlay — the original punch is preserved underneath, never overwritten.",
          "The employee is notified and can see the outcome on their own History page.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "Keeping the raw record intact is deliberate — it keeps every correction auditable later, including by Super Admin via the Audit Log (Chapter 10).",
      },
    ],
  },
  {
    number: "05",
    title: "Payroll Attendance",
    intro: "Period summaries, exports, and recompute.",
    blocks: [
      { type: "paragraph", text: "`/admin/payroll-attendance` turns raw daily attendance into payroll-period summaries." },
      {
        type: "paragraph",
        text: "Filter by shortfall, overtime, late arrivals, absences, or \"pending decision\" to find exceptions before a payroll run. Export the result to CSV or PDF for payroll processing or an audit trail, and use Refresh to manually recompute a period after late corrections land.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "BEFORE YOU EXPORT",
        text: "Clear out any still-pending regularization requests for the period first (Chapter 4) — approved corrections change the numbers that flow into payroll.",
      },
    ],
  },
  {
    number: "06",
    title: "Leave Management",
    intro: "Reviewing requests, the leave calendar, and leave policy vs. settings.",
    blocks: [
      { type: "paragraph", text: "Everything to do with organization-wide leave — requests, the calendar, and the policy document." },
      { type: "sectionHeading", text: "Leave requests — `/admin/leaves`" },
      {
        type: "paragraph",
        text: "Review every leave request in the organization: filter by status or search for a specific employee, approve or reject, and check anyone's leave balance overview from the same screen.",
      },
      { type: "sectionHeading", text: "Leave calendar — `/admin/calendar`" },
      {
        type: "paragraph",
        text: "An organization-wide calendar of approved leave and holidays, filterable by department — useful for spotting coverage gaps before approving more time off.",
      },
      { type: "sectionHeading", text: "Importing opening balances — `/admin/leaves/import`" },
      {
        type: "paragraph",
        text: "Migrate legacy EL/CL/SL balances from an Excel file. Each run is tracked as a single batch so its changes can be audited together as a unit. It's a \"set to\" operation — it sets each employee's balance to the value in the file rather than adding to it, so re-running the same file is safe and idempotent.",
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "The per-employee balance-adjustment form on an employee's profile (Chapter 3) also supports this \"set to\" mode alongside the existing add/deduct delta — use the bulk importer for a one-time migration, and the profile form for individual corrections afterward.",
      },
      { type: "sectionHeading", text: "Leave Policy vs. Leave Settings" },
      {
        type: "paragraph",
        text: "`/admin/leave-policy` is the read-only, employee-facing document. The actual rules behind it — leave cycle, Earned Leave accrual, Sick Leave policy — are configured separately under Settings → Leave Settings (Chapter 12). Edit the settings; the policy page updates to match automatically.",
      },
    ],
  },
  {
    number: "07",
    title: "Helpdesk — Tickets",
    intro: "Managing employee support requests.",
    blocks: [
      { type: "paragraph", text: "`/admin/tickets` is where every employee support request lands." },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Filter the queue by category (Attendance, Leave, Payroll, IT/Technical, HR, Workplace, Facilities, Suggestion, Other), status, or priority to triage quickly. Tickets move New → Open → In Progress → Resolved → Closed, with Waiting for Employee and On Hold available when you're blocked on their reply.",
      },
      {
        type: "steps",
        items: [
          "Open a ticket to see the employee's category, priority, subject, and description.",
          "Assign it to yourself or a colleague, and respond — replies can be public (visible to the employee) or internal notes (HR-only).",
          "Update status and priority as it progresses; every action is kept in a full audit trail on the ticket.",
        ],
      },
    ],
  },
  {
    number: "08",
    title: "Uploading Attendance Data",
    intro: "Importing biometric data from Excel or PDF.",
    blocks: [
      { type: "paragraph", text: "`/admin/upload` imports biometric attendance from the device export." },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Run imports before reviewing the regularization queue for the same period — that way you're approving corrections against complete data.",
      },
      {
        type: "steps",
        items: [
          "Choose the file — Excel or PDF, in either the eSSL Daily or Summary format.",
          "For large files, the upload is chunked and resumable, so a dropped connection doesn't mean starting over.",
          "If preview-before-confirm is enabled, review the parsed rows before they're committed.",
          "Confirm the import — the new punches flow into Attendance (Chapter 4) and, from there, Payroll Attendance (Chapter 5).",
        ],
      },
    ],
  },
  {
    number: "09",
    tag: "If Enabled",
    title: "Hiring Workspace",
    intro: "Recruitment, from job opening to converted employee.",
    blocks: [
      {
        type: "paragraph",
        text: "Recruitment is the largest module in ZEBL AMS and may be switched off in your organization's deployment — if you don't see this menu group, ask your Super Admin whether it should be turned on.",
      },
      { type: "sectionHeading", text: "The hiring flow moves in one direction" },
      {
        type: "table",
        columns: ["Stage", "Screen", "What happens"],
        widths: [16, 32, 52],
        rows: [
          ["1. Job Opening", "/admin/recruitment/jobs", "Create the posting, hiring team, headcount, and pipeline stage template."],
          ["2. Candidate", "/admin/recruitment/candidates", "Full profile — experience, education, skills, documents. Upload a resume and use the review-before-accept import draft rather than trusting parsing blindly."],
          ["3. Application", "/admin/recruitment/applications", "Link a candidate to a job; track pipeline status and the assigned recruiter."],
          ["4. Pipeline", "/admin/recruitment/pipeline", "A drag-and-drop board through hiring stages; launch interviews, offers, or a conversion from each card."],
          ["5. Interview", "/admin/recruitment/interviews", "Schedule, assign panelists, and collect structured feedback (rating, recommendation, strengths/concerns)."],
          ["6. Offer", "/admin/recruitment/offers", "Draft compensation → manager approval → HR approval → release → accept/decline. Produces a versioned offer-letter PDF."],
          ["7. Conversion", "/admin/recruitment/conversions", "The only path to \"hired\" — turns an accepted offer into a real Employee record, with a preview before you commit."],
        ],
      },
      {
        type: "paragraph",
        text: "Supporting screens: Communications (candidate email inbox/drafts/templates), Reports (time-to-hire, sources, funnel, offer acceptance), and Settings/Analytics for the module itself.",
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "A small number of managers may be individually granted recruitment access without becoming HR — if you see a manager acting in this module, that's expected and intentional, not a permissions gap.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "PUBLIC CAREER PORTAL",
        text: "External candidates apply through `/apply` — a public page requiring no login. It only exists while recruitment is enabled.",
      },
    ],
  },
  {
    number: "10",
    title: "System Operations",
    intro: "Analytics, operations health, notifications, integrations, audit log.",
    blocks: [
      { type: "paragraph", text: "Monitoring and configuration screens for the platform itself." },
      {
        type: "table",
        columns: ["Screen", "What it shows"],
        widths: [30, 70],
        rows: [
          ["/admin/analytics", "Workforce intelligence — an offline-computed executive snapshot: anomalies and operational metrics."],
          ["/admin/operations", "Background worker health, queue depth, failed jobs, and workflow integrity checks."],
          ["/admin/notifications", "The email/Teams notification delivery queue — failures and retries."],
          ["/admin/integrations", "Microsoft Teams webhook configuration, Outlook calendar sync status, Graph API health, escalation automation."],
          ["/admin/audit", "The centralized audit trail: auth events, employee/role changes, leave workflow, tickets, approval tokens, calendar sync, Teams, org sync."],
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "If an employee reports \"I approved this by email but nothing changed,\" check Operations and the Audit Log first — most one-time-link issues show up there as an expired or already-used token.",
      },
    ],
  },
  {
    number: "11",
    title: "Security & Sessions",
    intro: "Org-wide login history and what HR can and can't do here.",
    blocks: [
      {
        type: "paragraph",
        text: "`/admin/security` is the organization-wide login history and active session list — filterable by user, role, department, browser, date, or status.",
      },
      {
        type: "paragraph",
        text: "Use it to investigate a reported account issue or confirm someone's last sign-in. (Legacy links: `/admin/security/active-sessions` and `/admin/security/login-history` both redirect here.)",
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Narrow a search fast by combining filters — e.g. a specific user plus a date range, or a role plus a department — rather than scrolling the full org-wide list.",
      },
    ],
  },
  {
    number: "12",
    title: "Settings",
    intro: "HR, payroll, attendance, and leave configuration.",
    blocks: [
      { type: "paragraph", text: "Configuration for how the organization's rules are applied." },
      {
        type: "table",
        columns: ["Screen", "What you configure"],
        widths: [30, 70],
        rows: [
          ["/admin/settings", "Workflow escalation, notification, and integration defaults; also your own change-password form."],
          ["/admin/payroll-settings", "Payroll cycle start day, required office time, grace period, overtime thresholds, and per-shift overrides."],
          ["/admin/shift-settings (view only)", "Named shifts — start/end time, grace period, expected work minutes — used across employee records and the attendance register. You can view this screen, but the form is read-only for HR; only Super Admin can save changes here."],
          ["/admin/attendance-settings (view only)", "Default weekly working-day schedule and date-specific exceptions. You can view this screen, but the form is read-only for HR — only Super Admin can save changes here."],
          ["/admin/leave-settings", "Leave cycle, Earned Leave accrual rules, Sick Leave policy — this is what feeds the read-only Leave Policy page (Chapter 6)."],
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "If you need a change to the weekly working-day schedule, a date override, or a shift definition, raise it with your Super Admin — you'll see the current configuration but the save action is disabled for HR by design.",
      },
    ],
  },
  {
    number: "13",
    tag: "If Applicable",
    title: "My Own Workspace",
    intro: "If you're also an employee of the company yourself.",
    blocks: [
      {
        type: "paragraph",
        text: "If you, as an HR user, are also linked to an employee record — because you're an employee of the company yourself — a My Workspace group appears in your menu.",
      },
      {
        type: "cards",
        items: [
          { title: "My Dashboard", text: "Your own attendance snapshot." },
          { title: "My Attendance", text: "Your own history." },
          { title: "My Leaves", text: "Your own balances and requests." },
          { title: "My Profile", text: "Your own details and photo." },
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "You will not get \"My Team,\" ticket-raising, or an Approval Center here — those are Employee/Manager-shell features. Use them only if you're specifically acting as an approver elsewhere in the organization's chart.",
      },
    ],
  },
  {
    number: "14",
    title: "Where HR's Access Ends",
    intro: "What only a Super Admin can do, and why.",
    blocks: [
      {
        type: "paragraph",
        text: "HR and Super Admin share nearly the entire admin workspace. These are the specific, deliberate exceptions — know them so you can escalate quickly instead of hunting for a missing button.",
      },
      {
        type: "table",
        columns: ["Area", "HR", "Super Admin"],
        widths: [28, 36, 36],
        rows: [
          ["User accounts & roles", "Can administer Employee and Manager accounts only (reset password, lock/unlock)", "Full access, including HR and Super Admin accounts"],
          ["Changing a user's role", "Not available", "Only place this can be done — at /admin/user-management"],
          ["Attendance scheduling settings", "View only", "Can edit"],
          ["Shift definitions", "View only", "Can edit"],
          ["Anonymous tickets", "No access", "Full access, including submitter identity"],
          ["Force-expiring a user's session", "Not available", "Available on /admin/security"],
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "None of this is a bug if a button is missing or a form is disabled — it's the platform's target-aware permission model working as intended. Raise a ticket or reach out directly to your Super Admin for anything in this table.",
      },
    ],
  },
  {
    number: "15",
    title: "Getting Help & FAQ",
    intro: "Common questions, answered.",
    blocks: [
      { type: "sectionHeading", text: "An employee says their punch is missing entirely, not just wrong — what do I do?" },
      {
        type: "paragraph",
        text: "Check whether the day's device export was imported (Chapter 8) before assuming it's a regularization case — a missing day usually means the import hasn't run yet for that date.",
      },
      { type: "sectionHeading", text: "I changed someone's role-adjacent setting (like recruitment ops access) and nothing changed — why?" },
      {
        type: "paragraph",
        text: "Permission and role changes require the affected user to sign in again — the change is carried in their session and won't apply until they refresh it by logging out and back in.",
      },
      { type: "sectionHeading", text: "Why can't I edit the attendance settings or shift settings pages?" },
      { type: "paragraph", text: "That's expected — both are Super Admin-only to edit, HR-viewable only. See Chapter 14." },
      { type: "sectionHeading", text: "An employee wants to submit a ticket anonymously — can I see who it is?" },
      { type: "paragraph", text: "No. Anonymous ticket identity is visible to Super Admin only, by design." },
      { type: "sectionHeading", text: "I suspect an account is compromised — what do I do?" },
      {
        type: "paragraph",
        text: "Escalate to your Super Admin immediately — you can see the account's sessions at `/admin/security`, but only Super Admin can force-expire them (Chapter 14).",
      },
      { type: "sectionHeading", text: "Where do I go for anything not covered in this guide?" },
      {
        type: "paragraph",
        text: "Check the Audit Log (Chapter 10) for a factual trail of what happened, or escalate to your Super Admin for anything listed in Chapter 14.",
      },
    ],
  },
];
