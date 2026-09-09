import type { HelpChapter } from "@/lib/help/types";

export const superAdminHelpChapters: HelpChapter[] = [
  {
    number: "01",
    title: "Getting Started",
    intro: "Signing in and how the admin workspace is laid out for you.",
    blocks: [
      {
        type: "paragraph",
        text: "This guide covers the Super Admin role — the platform's highest level of access. You see everything HR sees, plus platform administration and a few elevated actions on screens you otherwise share with HR.",
      },
      { type: "sectionHeading", text: "Signing in" },
      {
        type: "paragraph",
        text: "Sign in with your work email and password, or Sign in with Microsoft if Entra ID is connected. You land on the HR Command Center at `/admin/dashboard` — the same home screen as HR.",
      },
      { type: "sectionHeading", text: "How the admin workspace is organized" },
      {
        type: "paragraph",
        text: "The left-hand menu groups everything into: Core Workforce (Chapters 3–8), Hiring Workspace (Chapter 9, if recruitment is enabled), System Operations (Chapter 10), Security (Chapter 11), Settings (Chapter 12), and — unique to you — Platform Administration (Chapter 13). If you're personally linked to an employee record, you'll also see My Workspace (Chapter 14).",
      },
      {
        type: "callout",
        kind: "exclusive",
        label: "HOW THIS GUIDE DIFFERS FROM THE HR GUIDE",
        text: "Chapters 2–12 describe screens you share with HR almost entirely as-is — with elevated capability called out wherever it applies. Chapter 13 is exclusively yours.",
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
        text: "Your dashboard (`/admin/dashboard`) is the executive view of the whole organization: headcount, attendance and leave snapshots, and pending approvals.",
      },
      { type: "paragraph", text: "Use it as your daily starting point before drilling into a specific module." },
    ],
  },
  {
    number: "03",
    title: "Employees",
    intro: "The directory and full employee profile.",
    blocks: [
      { type: "paragraph", text: "Employees (`/admin/employees`) is the organization's people directory." },
      { type: "sectionHeading", text: "Browsing and searching" },
      { type: "paragraph", text: "Search or filter the full employee list, then open any record to reach its profile." },
      { type: "sectionHeading", text: "Employee profile — `/admin/employees/[id]`" },
      {
        type: "paragraph",
        text: "Identity, a date-range filterable attendance summary, leave balances and history, and manager assignment — who this person reports to, which drives their manager's \"My Team\" view.",
      },
      {
        type: "callout",
        kind: "exclusive",
        label: "NOTE",
        text: "Administering an HR or Super Admin account (password reset, lock/unlock) is something only you can do — HR can only administer Employee and Manager accounts. See Chapter 13 for role changes specifically.",
      },
    ],
  },
  {
    number: "04",
    title: "Attendance & Regularization",
    intro: "The daily register and the correction-request queue.",
    blocks: [
      { type: "paragraph", text: "The org-wide register, and the queue of correction requests waiting on a decision." },
      { type: "sectionHeading", text: "Attendance register — `/admin/attendance`" },
      {
        type: "paragraph",
        text: "Search and filter every employee's daily attendance by date, payroll period, shift, shortfall, or overtime. Days with an active regularization request are flagged.",
      },
      { type: "sectionHeading", text: "Regularization queue — `/admin/attendance/regularization`" },
      { type: "paragraph", text: "Correction requests organized into Pending, Approved, Rejected, and Cancelled tabs." },
      {
        type: "steps",
        items: [
          "Open a pending request to see the stated reason next to the original raw punch record.",
          "Approve or reject — approving applies a correction overlay; the original punch is preserved, never overwritten.",
          "The employee is notified and sees the outcome on their own History page.",
        ],
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
        text: "Filter by shortfall, overtime, late arrivals, absences, or \"pending decision.\" Export to CSV or PDF for payroll processing, and use Refresh to recompute a period after late corrections land.",
      },
    ],
  },
  {
    number: "06",
    title: "Leave Management",
    intro: "Reviewing requests, the leave calendar, and leave policy vs. settings.",
    blocks: [
      { type: "paragraph", text: "Organization-wide leave — requests, calendar, and policy." },
      { type: "sectionHeading", text: "Leave requests — `/admin/leaves`" },
      { type: "paragraph", text: "Review every leave request: filter by status or search, approve or reject, and check anyone's balance overview." },
      { type: "sectionHeading", text: "Leave calendar — `/admin/calendar`" },
      { type: "paragraph", text: "Organization-wide approved leave and holidays, filterable by department." },
      { type: "sectionHeading", text: "Importing opening balances — `/admin/leaves/import`" },
      {
        type: "paragraph",
        text: "Migrate legacy EL/CL/SL balances from an Excel file. Each run is tracked as a single batch so its changes can be audited together as a unit — it's a \"set to\" operation, so re-running the same file is safe and idempotent.",
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "The per-employee balance-adjustment form on an employee's profile (Chapter 3) also supports this \"set to\" mode alongside the existing add/deduct delta — use the bulk importer for a one-time migration, and the profile form for individual corrections.",
      },
      { type: "sectionHeading", text: "Leave Policy vs. Leave Settings" },
      {
        type: "paragraph",
        text: "`/admin/leave-policy` is the read-only, published document. The actual rules are configured at Settings → Leave Settings (Chapter 12) and flow through automatically.",
      },
    ],
  },
  {
    number: "07",
    title: "Helpdesk — Tickets & Anonymous Tickets",
    intro: "Managing employee support requests, including anonymous ones.",
    blocks: [
      { type: "paragraph", text: "`/admin/tickets` is where every employee support request lands — plus one screen only you can see." },
      {
        type: "callout",
        kind: "exclusive",
        label: "SUPER ADMIN ONLY",
        text: "`/admin/tickets/anonymous` lists tickets submitted anonymously — with the submitter's real identity revealed. HR and everyone else is redirected away from this screen; use it sparingly and only when there's a genuine need to know who filed it.",
      },
      {
        type: "steps",
        items: [
          "Open a ticket to see category, priority, subject, and description.",
          "Assign it, and respond publicly or with an internal HR-only note.",
          "Update status and priority; every action is kept in a full audit trail.",
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
        type: "steps",
        items: [
          "Choose the file — Excel or PDF, eSSL Daily or Summary format.",
          "Large files upload in resumable chunks.",
          "Review parsed rows in preview mode if enabled.",
          "Confirm — new punches flow into Attendance and Payroll Attendance.",
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
      { type: "paragraph", text: "Recruitment is feature-flagged; toggling it on or off for the organization is your call." },
      {
        type: "table",
        columns: ["Stage", "Screen", "What happens"],
        widths: [16, 32, 52],
        rows: [
          ["1. Job Opening", "/admin/recruitment/jobs", "Create the posting, hiring team, headcount, pipeline stage template."],
          ["2. Candidate", "/admin/recruitment/candidates", "Full profile; resume upload with a review-before-accept import draft."],
          ["3. Application", "/admin/recruitment/applications", "Link a candidate to a job; track pipeline status and recruiter."],
          ["4. Pipeline", "/admin/recruitment/pipeline", "Drag-and-drop board; launch interviews, offers, or conversion."],
          ["5. Interview", "/admin/recruitment/interviews", "Schedule, assign panelists, collect structured feedback."],
          ["6. Offer", "/admin/recruitment/offers", "Draft → manager approval → HR approval → release → accept/decline. Versioned offer-letter PDF."],
          ["7. Conversion", "/admin/recruitment/conversions", "The only path to \"hired\" — converts an accepted offer into an Employee record."],
        ],
      },
      { type: "paragraph", text: "Supporting screens: Communications, Reports, and module Settings/Analytics." },
      {
        type: "callout",
        kind: "exclusive",
        label: "YOUR CALL TO MAKE",
        text: "Enabling recruitment, and granting a manager standalone recruitment access without promoting them to HR, are both organization-level decisions that sit with you.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "PUBLIC CAREER PORTAL",
        text: "External candidates apply through `/apply` — public, no login required, and only reachable while recruitment is enabled.",
      },
    ],
  },
  {
    number: "10",
    title: "System Operations",
    intro: "Analytics, operations health, notifications, integrations, audit log.",
    blocks: [
      { type: "paragraph", text: "Monitoring and configuration for the platform itself." },
      {
        type: "table",
        columns: ["Screen", "What it shows"],
        widths: [30, 70],
        rows: [
          ["/admin/analytics", "Workforce intelligence — offline-computed executive snapshot, anomalies, operational metrics."],
          ["/admin/operations", "Background worker health, queue depth, failed jobs, workflow integrity."],
          ["/admin/notifications", "Email/Teams notification delivery queue — failures and retries."],
          ["/admin/integrations", "Microsoft Teams webhook, Outlook calendar sync status, Graph API health, escalation automation."],
          ["/admin/audit", "The centralized audit trail across auth, employee/role admin, leave workflow, tickets, approval tokens, calendar sync, Teams, org sync."],
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "The Audit Log is your first stop whenever something needs to be reconstructed after the fact — who changed a role, who approved what, and when.",
      },
    ],
  },
  {
    number: "11",
    title: "Security & Sessions",
    intro: "Org-wide login history, with full authority to act.",
    blocks: [
      {
        type: "paragraph",
        text: "`/admin/security` is the organization-wide login history and active session list — filterable by user, role, department, browser, date, or status.",
      },
      {
        type: "callout",
        kind: "exclusive",
        label: "ONLY YOU CAN ACT HERE",
        text: "You can force-expire or revoke any user's active session directly from this screen — HR can view the same data but cannot act on it. Use this for a compromised account or a device that must be signed out immediately.",
      },
      {
        type: "paragraph",
        text: "Legacy links `/admin/security/active-sessions` and `/admin/security/login-history` both redirect here.",
      },
    ],
  },
  {
    number: "12",
    title: "Settings",
    intro: "HR, payroll, attendance, and leave configuration — including the edit-only screens.",
    blocks: [
      { type: "paragraph", text: "Configuration for how the organization's rules are applied — including the screens only you can edit." },
      {
        type: "table",
        columns: ["Screen", "What you configure"],
        widths: [30, 70],
        rows: [
          ["/admin/settings", "Workflow escalation, notification, and integration defaults; your own change-password form."],
          ["/admin/payroll-settings", "Payroll cycle start day, required office time, grace period, overtime thresholds, per-shift overrides."],
          ["/admin/shift-settings (edit: you only)", "Named shifts — start/end time, grace period, expected work minutes. HR can view this screen, but only you can save changes."],
          ["/admin/attendance-settings (edit: you only)", "Default weekly working-day schedule and date-specific exceptions. HR can view this screen, but only you can save changes."],
          ["/admin/leave-settings", "Leave cycle, Earned Leave accrual, Sick Leave policy — feeds the read-only Leave Policy page."],
        ],
      },
    ],
  },
  {
    number: "13",
    tag: "Exclusive",
    title: "Platform Administration",
    intro: "User & role management — exclusive to Super Admin.",
    blocks: [
      {
        type: "paragraph",
        text: "This menu group exists only for Super Admin. It carries real consequences — read each section before acting.",
      },
      { type: "sectionHeading", text: "User Management — `/admin/user-management`" },
      {
        type: "paragraph",
        text: "The only place in ZEBL AMS to change a user's role, and the only place to activate or deactivate an account. Filter by role, status, or search.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "BEFORE PROMOTING SOMEONE TO HR OR SUPER ADMIN",
        text: "That account immediately gains organization-wide visibility into attendance, leave, and (if enabled) recruitment data. Treat it the same as any other access-elevation decision in your organization.",
      },
      { type: "sectionHeading", text: "Anonymous Tickets — `/admin/tickets/anonymous`" },
      {
        type: "paragraph",
        text: "Covered in Chapter 7 — repeated here because it's part of the same exclusive menu group. Every other role, including HR, is redirected away from this URL.",
      },
      {
        type: "steps",
        items: [
          "Find the user and open their record.",
          "Change their role, or toggle their account active/inactive.",
          "Save. The affected user must sign out and back in before the change takes effect — their current session still carries the old permissions until they refresh it.",
        ],
      },
    ],
  },
  {
    number: "14",
    tag: "If Applicable",
    title: "My Own Workspace",
    intro: "If you're also an employee of the company yourself.",
    blocks: [
      {
        type: "paragraph",
        text: "If you're also linked to an employee record — because you're an employee of the company yourself — a My Workspace group appears in your menu.",
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
        text: "You will not get \"My Team,\" ticket-raising, or an Approval Center here — those are Employee/Manager-shell features, separate from your administrative access.",
      },
    ],
  },
  {
    number: "15",
    title: "Getting Help & FAQ",
    intro: "Common questions, answered.",
    blocks: [
      { type: "sectionHeading", text: "I changed a user's role and they say nothing changed — why?" },
      { type: "paragraph", text: "They need to sign out and back in. Role and permission changes are carried in the session and only apply on the next login." },
      { type: "sectionHeading", text: "An account is compromised right now — what's the fastest way to lock it down?" },
      {
        type: "paragraph",
        text: "Go to `/admin/security`, find their active sessions, and force-expire them. Then deactivate the account from `/admin/user-management` if needed, and reset their password.",
      },
      { type: "sectionHeading", text: "Can HR ever see who filed an anonymous ticket?" },
      { type: "paragraph", text: "No — that identity is visible only to Super Admin, by design, regardless of ticket content or urgency." },
      { type: "sectionHeading", text: "Should I enable Recruitment for the organization?" },
      {
        type: "paragraph",
        text: "It's off by default and is a large module. Turn it on when your organization is ready to run hiring through the platform — see Chapter 9 for what that unlocks.",
      },
      { type: "sectionHeading", text: "Who can define or edit shifts?" },
      {
        type: "paragraph",
        text: "Only you, at `/admin/shift-settings`. HR can view the list but the save action is disabled for them by design — same pattern as attendance scheduling.",
      },
      { type: "sectionHeading", text: "Where's the definitive record of who did what?" },
      {
        type: "paragraph",
        text: "The Audit Log (`/admin/audit`, Chapter 10) — it covers auth, role changes, leave workflow, tickets, approval tokens, and sync events.",
      },
    ],
  },
];
