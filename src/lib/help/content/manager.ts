import type { HelpChapter } from "@/lib/help/types";

/**
 * Full Manager guide. Chapter 6 ("Leading Your Team") only applies once the
 * viewer actually has direct reports — see resolveMyTeamNavContext, the same
 * signal the sidebar's "My Team" group uses. Callers filter it out otherwise.
 */
export const managerHelpChapters: HelpChapter[] = [
  {
    number: "01",
    title: "Getting Started",
    intro: "Logging in and understanding when \"My Team\" appears for you.",
    blocks: [
      {
        type: "paragraph",
        text: "This guide covers the Manager workspace of ZEBL AMS. You get everything an Employee has — your own attendance, leave, and tickets — plus a My Team area for the people who report to you.",
      },
      { type: "sectionHeading", text: "Signing in" },
      {
        type: "paragraph",
        text: "Sign in with your work email and password, or Sign in with Microsoft if your organization has connected Entra ID. Both take you to the same workspace.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "FIRST LOGIN",
        text: "A brand-new account requires you to set your own password before anything else loads — this cannot be skipped.",
      },
      { type: "sectionHeading", text: "When does \"My Team\" appear?" },
      {
        type: "paragraph",
        text: "The My Team menu group shows up automatically as soon as you have at least one active direct report in the organization chart — it is driven by who reports to you, not by an on/off switch you control. In practice: if you currently have no direct reports, your menu looks identical to an Employee's — that's expected, not an error. As soon as HR assigns someone to report to you, My Team appears the next time your session refreshes. If someone stops reporting to you, they simply drop out of your team views.",
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "Approving a specific leave request depends on whether you're actually named in that request's approval chain — not just on having the Manager label on your account. If a request doesn't show up for you to act on, it likely isn't waiting on you.",
      },
    ],
  },
  {
    number: "02",
    title: "Your Dashboard",
    intro: "Today's status, KPI cards, and your monthly attendance heatmap.",
    blocks: [
      {
        type: "paragraph",
        text: "Your dashboard (`/employee/dashboard`) is your personal home screen — it covers you, not your team.",
      },
      {
        type: "cards",
        items: [
          { title: "Today's status", text: "Whether you've clocked in today, your first-in / last-out time, and whether today is trending late, on-time, or incomplete." },
          { title: "KPI cards", text: "Your rolled-up numbers for the current period — present days, late arrivals, early exits, overtime, and shortfall hours." },
          { title: "Attendance heatmap", text: "A calendar-style heatmap of your month, color-coded by day status, with your on-time streak highlighted." },
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Team-wide numbers live under My Team → Overview — see Chapter 6.",
      },
    ],
  },
  {
    number: "03",
    title: "Your Profile",
    intro: "Viewing your details and updating your photo.",
    blocks: [
      {
        type: "paragraph",
        text: "Your profile page (`/employee/profile`) shows your identity — name and email — plus your profile photo.",
      },
      { type: "sectionHeading", text: "Updating your photo" },
      {
        type: "steps",
        items: [
          "Go to Profile in the left menu.",
          "Select Change photo and choose an image from your device.",
          "Confirm and save — the new photo appears immediately, including in your team's People list.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "Your name and email are managed by HR. Raise a ticket (Chapter 7) if either needs correcting.",
      },
    ],
  },
  {
    number: "04",
    title: "Attendance & Regularization",
    intro: "Reading your own history and fixing a punch that looks wrong.",
    blocks: [
      { type: "paragraph", text: "History (`/employee/attendance`) is your own full attendance record." },
      { type: "sectionHeading", text: "Reading your history" },
      {
        type: "paragraph",
        text: "Filter by date range to jump to any past period. Each row shows your first-in and last-out punches plus flags for late arrival, early exit, overtime, or shortfall.",
      },
      { type: "sectionHeading", text: "Requesting a correction" },
      {
        type: "paragraph",
        text: "Your punch data comes straight from the biometric device and is never edited directly. If a day looks wrong, submit a regularization request against it.",
      },
      {
        type: "steps",
        items: [
          "Open the day in question from History.",
          "Select Request correction and explain what actually happened.",
          "Submit — it goes to HR's regularization queue, the same as any employee's request.",
          "Track status — Pending, Approved, Rejected, or Cancelled — on the entry itself.",
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "This is entirely separate from approving your team's attendance corrections — as a manager you don't approve regularization requests (HR does); you only submit your own.",
      },
    ],
  },
  {
    number: "05",
    title: "Your Leave",
    intro: "Your balances, holidays, requesting leave, and the policy document.",
    blocks: [
      {
        type: "paragraph",
        text: "Manage your own time off under Leaves (`/employee/leaves`) — separate from approving your team's leave.",
      },
      { type: "sectionHeading", text: "Balances and holidays" },
      {
        type: "paragraph",
        text: "See your current balance by leave type (Earned Leave, Sick Leave, Casual Leave, etc.) and the organization's upcoming holidays.",
      },
      { type: "sectionHeading", text: "Requesting leave" },
      {
        type: "steps",
        items: [
          "Select Request leave.",
          "Choose the leave type, dates, and add a reason.",
          "Submit — this routes to your approver (typically your own manager or HR), not to you.",
          "Track progress on the same page.",
        ],
      },
      { type: "sectionHeading", text: "Leave Policy" },
      { type: "paragraph", text: "Leave Policy is the read-only, published version of your organization's leave rules." },
    ],
  },
  {
    number: "06",
    title: "Leading Your Team",
    intro: "Team overview, approvals, people, team attendance, leave, and calendar.",
    blocks: [
      {
        type: "paragraph",
        text: "The My Team menu group is where your responsibilities as a manager live. It only shows data for your direct reports.",
      },
      { type: "sectionHeading", text: "Team Overview — `/employee/team`" },
      { type: "paragraph", text: "A snapshot of your team: headcount, who's present today, and pending items that need your attention." },
      { type: "sectionHeading", text: "Approvals — `/employee/approvals`" },
      {
        type: "paragraph",
        text: "Your approval inbox. Every leave request currently waiting on you as an approver appears here, regardless of whether the requester reports to you directly or is elsewhere in the chain you're part of.",
      },
      {
        type: "steps",
        items: [
          "Open a request to see the requester, dates, leave type, and their reason.",
          "Approve or reject, adding a comment if useful.",
          "The requester is notified automatically and the request moves to its next step (further approval, or done).",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "\"Leave\" is currently the only approval type here — the Approval Center is built to support other request types as the organization adds them.",
      },
      { type: "sectionHeading", text: "People — `/employee/team/people`" },
      {
        type: "paragraph",
        text: "A list of your direct reports. Click through to a read-only detail view of each person — their attendance summary, leave history, and profile. You can't edit their profile photo or details from here; that stays with HR or the individual themselves.",
      },
      { type: "sectionHeading", text: "Team Attendance — `/employee/team/attendance`" },
      {
        type: "paragraph",
        text: "An attendance register scoped to your reports only. Filter by date range and status (late, early exit, overtime, shortfall), sort, and page through results — the same lens HR uses org-wide, but limited to your people.",
      },
      { type: "sectionHeading", text: "Team Leave — `/employee/team/leave`" },
      { type: "paragraph", text: "An overview of your team's leave — who's out, who's upcoming, and balances at a glance." },
      { type: "sectionHeading", text: "Team Calendar — `/employee/team/calendar`" },
      {
        type: "paragraph",
        text: "A month, week, or range view of your team's approved leave, useful for planning coverage before you approve new requests.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "ONE-TIME APPROVAL LINKS",
        text: "If you're named as an approver on a request, you may also receive a secure, one-time link by email or Microsoft Teams that lets you approve or reject directly from your inbox — no login needed. It works once and expires after a set number of hours, so use it promptly or just approve from Approvals instead.",
      },
    ],
  },
  {
    number: "07",
    title: "Helpdesk — My Tickets",
    intro: "Raising a request to HR and tracking the reply.",
    blocks: [
      { type: "paragraph", text: "Use My Tickets (`/employee/tickets`) to reach HR for anything that isn't self-service." },
      {
        type: "steps",
        items: [
          "Select New ticket.",
          "Pick a category and priority, then add a subject and description.",
          "Submit — HR is notified.",
          "Reply in the thread; you'll see HR's public replies, but internal HR-only notes stay hidden.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "This is your personal ticket queue, not a place to manage tickets on behalf of your team — each of your reports raises their own.",
      },
    ],
  },
  {
    number: "08",
    title: "Notifications & Settings",
    intro: "Controlling alerts and changing your password.",
    blocks: [
      {
        type: "paragraph",
        text: "Settings (`/employee/settings`) controls how ZEBL AMS reaches you and keeps your password current.",
      },
      {
        type: "table",
        columns: ["Setting", "What it does"],
        widths: [32, 68],
        rows: [
          ["Notification preferences", "Choose which alerts you get — including approval requests waiting on you."],
          ["Change password", "Update your password any time."],
          ["Profile photo shortcut", "Quick link back to the photo uploader on your Profile page."],
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Keep approval notifications on — they're how you find out a request needs you without checking the Approval Center manually.",
      },
    ],
  },
  {
    number: "09",
    title: "Security & Sessions",
    intro: "Reviewing your sign-ins and signing out other devices.",
    blocks: [
      {
        type: "paragraph",
        text: "Security (`/employee/security`) shows your own sign-in history and every device currently signed in to your account.",
      },
      {
        type: "paragraph",
        text: "Each entry lists the browser, approximate location/IP, and time. If you don't recognize a sign-in, end that session immediately and change your password.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "WHY IT MATTERS MORE FOR YOU",
        text: "As an approver, your account can move real leave decisions for your team — treat an unrecognized session as urgent.",
      },
    ],
  },
  {
    number: "10",
    tag: "Conditional",
    title: "Interview Invitations",
    intro: "If you've been asked to sit on an interview panel.",
    blocks: [
      { type: "paragraph", text: "This only applies if you've been asked to interview a candidate." },
      {
        type: "paragraph",
        text: "If a recruiter adds you as a panelist, an Interviews item appears automatically (`/employee/interviews`), listing your upcoming, completed, and cancelled interviews.",
      },
      {
        type: "steps",
        items: [
          "Open the interview to review the candidate's profile.",
          "After the interview, record your rating, recommendation, strengths, and concerns.",
          "The item disappears once you have no active panel assignments.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "A small number of managers are separately granted broader recruitment access (job openings, pipeline, offers). If that applies to you, HR will tell you directly — it isn't part of the standard Manager workspace.",
      },
    ],
  },
  {
    number: "11",
    title: "Getting Help & FAQ",
    intro: "Common questions, answered.",
    blocks: [
      { type: "sectionHeading", text: "Someone reports to me but I don't see \"My Team\" — why?" },
      {
        type: "paragraph",
        text: "The org-chart change may not have taken effect on your current session yet. Sign out and back in; if it still doesn't appear, raise a ticket to HR to confirm the reporting line is set correctly.",
      },
      { type: "sectionHeading", text: "A leave request I expected to approve isn't in my Approval Center — why?" },
      {
        type: "paragraph",
        text: "Approval routing follows the organization's configured chain for that request, which may not always be you first (or at all) — check with HR if you believe you should be in the chain.",
      },
      { type: "sectionHeading", text: "Can I edit a team member's profile or attendance record?" },
      {
        type: "paragraph",
        text: "No — People and Team Attendance are read-only for you. Corrections to punch data go through the employee's own regularization request, reviewed by HR.",
      },
      { type: "sectionHeading", text: "I got an email with an approve/reject link — is it safe to click?" },
      {
        type: "paragraph",
        text: "Yes, if it was sent to your work email or posted in Teams by the system. It's a single-use, time-limited link tied to one specific request.",
      },
      { type: "sectionHeading", text: "Who do I contact for anything not covered here?" },
      { type: "paragraph", text: "Raise a ticket from My Tickets — that reaches HR directly inside the system." },
    ],
  },
];
