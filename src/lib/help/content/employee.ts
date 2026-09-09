import type { HelpChapter } from "@/lib/help/types";

export const employeeHelpChapters: HelpChapter[] = [
  {
    number: "01",
    title: "Getting Started",
    intro: "Logging in, first-time password change, and finding your way around.",
    blocks: [
      {
        type: "paragraph",
        text: "This guide covers the Employee workspace of ZEBL AMS — the self-service area where you check your attendance, manage leave, and reach HR. If you lead a team, ask HR whether the Manager Guide applies to you instead.",
      },
      { type: "sectionHeading", text: "Signing in" },
      {
        type: "paragraph",
        text: "Open the ZEBL AMS login page and sign in with your work email and password. If your organization has connected Microsoft Entra ID, you'll also see a Sign in with Microsoft button — either option takes you to the same workspace.",
      },
      {
        type: "callout",
        kind: "warning",
        label: "FIRST LOGIN",
        text: "If HR just created your account, you'll be asked to set a new password before you can do anything else. This screen cannot be skipped — choose a password only you know, and you're in.",
      },
      { type: "sectionHeading", text: "Finding your way around" },
      {
        type: "paragraph",
        text: "Once signed in, you land on your `Dashboard`. The left-hand menu is grouped under Workspace and lists everything covered in this guide: Dashboard, Profile, History, Leaves, Leave Policy, My Tickets, Settings, and Security. Your name and photo sit in the top corner — click them any time to jump to your profile.",
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "Every screen in your workspace only ever shows your own records. Seeing a colleague's attendance or approving someone else's leave depends on having direct reports assigned to you in the org chart — check with HR if you believe that should apply to you.",
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
        text: "Your dashboard (`/employee/dashboard`) is built to answer one question at a glance: how am I doing this month?",
      },
      {
        type: "cards",
        items: [
          { title: "Today's status", text: "A hero widget showing whether you've clocked in, your first-in / last-out time, and whether today is trending late, on-time, or incomplete." },
          { title: "KPI cards", text: "Rolled-up numbers for the current period — present days, late arrivals, early exits, overtime, and shortfall hours." },
          { title: "Attendance heatmap", text: "A calendar-style heatmap of the month, color-coded by day status, with your current on-time streak highlighted." },
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Hover or tap a day in the heatmap to see exactly what was recorded for it. If a day looks wrong, jump straight to History (Chapter 4) to raise a correction.",
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
        text: "Your profile page (`/employee/profile`) shows your identity — name and email — as held by HR, plus your profile photo.",
      },
      { type: "sectionHeading", text: "Updating your photo" },
      {
        type: "steps",
        items: [
          "Go to Profile in the left menu.",
          "Select Change photo and choose an image from your device.",
          "Confirm the crop/preview, then save. Your new photo appears immediately across the dashboard, top bar, and any team views you appear in.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "Your name and email are managed by HR. If either is wrong, raise a ticket from My Tickets (Chapter 6) rather than trying to edit it yourself.",
      },
    ],
  },
  {
    number: "04",
    title: "Attendance & Regularization",
    intro: "Reading your history and fixing a punch that looks wrong.",
    blocks: [
      {
        type: "paragraph",
        text: "History (`/employee/attendance`) is your full personal attendance record — every day, exactly as the system captured it.",
      },
      { type: "sectionHeading", text: "Reading your history" },
      {
        type: "paragraph",
        text: "Use the date-range filter to jump to any past period; results are paginated so recent days always load first. Each row shows your first-in and last-out punches plus flags for late arrival, early exit, overtime, or shortfall against your expected hours.",
      },
      { type: "sectionHeading", text: "Requesting a correction" },
      {
        type: "paragraph",
        text: "Punch data comes from the biometric device and is never edited directly — not even by HR. If a day looks wrong (a missed punch, a device glitch, an approved late arrival that wasn't recorded), you submit a regularization request and HR reviews it against the original record.",
      },
      {
        type: "steps",
        items: [
          "Open the day in question from History.",
          "Select Request correction and state what actually happened and why.",
          "Submit. The request lands in HR's regularization queue.",
          "Track its status — Pending, Approved, Rejected, or Cancelled — directly on that day's entry.",
        ],
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "If HR approves your request, the day shows both the original punch record and the approved correction — nothing is silently overwritten, so the history stays auditable.",
      },
    ],
  },
  {
    number: "05",
    title: "Leave Management",
    intro: "Balances, holidays, requesting leave, and the policy document.",
    blocks: [
      { type: "paragraph", text: "Everything about your leave lives under Leaves (`/employee/leaves`)." },
      { type: "sectionHeading", text: "Balances and holidays" },
      {
        type: "paragraph",
        text: "At the top of the page you'll see your current balance broken down by leave type (e.g. Earned Leave, Sick Leave, Casual Leave), plus the organization's upcoming holiday list.",
      },
      { type: "sectionHeading", text: "Requesting leave" },
      {
        type: "steps",
        items: [
          "Select Request leave.",
          "Choose the leave type, start and end dates, and add a reason.",
          "Submit — this starts a multi-step approval chain (typically your manager, then HR).",
          "Track the request's progress and current approver on the same page.",
        ],
      },
      {
        type: "callout",
        kind: "note",
        label: "NOTE",
        text: "If your Earned Leave balance runs out, the system can automatically convert unpaid days to Loss of Pay (LOP) per policy — check your balance before requesting extended leave.",
      },
      { type: "sectionHeading", text: "Leave Policy" },
      {
        type: "paragraph",
        text: "Leave Policy is a read-only page showing your organization's published leave rules — accrual, carry-forward, and eligibility — exactly as HR has configured them.",
      },
    ],
  },
  {
    number: "06",
    title: "Helpdesk — My Tickets",
    intro: "Raising a request to HR and tracking the reply.",
    blocks: [
      {
        type: "paragraph",
        text: "Use My Tickets (`/employee/tickets`) whenever you need HR's help with something that isn't self-service — a payslip query, a document request, an access issue.",
      },
      {
        type: "steps",
        items: [
          "Select New ticket.",
          "Pick a category and priority, then add a subject and description.",
          "Submit — HR is notified and the ticket appears in your list.",
          "Reply in the thread as needed; you'll see HR's public replies, though any internal HR-only notes stay hidden from you.",
        ],
      },
      {
        type: "callout",
        kind: "warning",
        label: "SENSITIVE TOPICS",
        text: "If your organization has anonymous ticketing enabled, use that option for matters you'd rather not attach your name to — only the Super Admin can see the submitter's identity on those.",
      },
    ],
  },
  {
    number: "07",
    title: "Notifications & Settings",
    intro: "Controlling alerts and changing your password.",
    blocks: [
      {
        type: "paragraph",
        text: "Settings (`/employee/settings`) is where you control how ZEBL AMS reaches you and keep your password current.",
      },
      {
        type: "table",
        columns: ["Setting", "What it does"],
        widths: [32, 68],
        rows: [
          ["Notification preferences", "Choose which email/Teams alerts you receive — approval updates, ticket replies, reminders."],
          ["Change password", "Update your password at any time; you don't need to wait for it to expire."],
          ["Profile photo shortcut", "A quick link back to the photo uploader on your Profile page."],
        ],
      },
    ],
  },
  {
    number: "08",
    title: "Security & Sessions",
    intro: "Reviewing your sign-ins and signing out other devices.",
    blocks: [
      {
        type: "paragraph",
        text: "Security (`/employee/security`) shows your own sign-in history and every device currently signed in to your account.",
      },
      {
        type: "paragraph",
        text: "Each entry lists the browser, approximate location/IP, and time. If you spot a sign-in you don't recognize, end that session immediately and change your password from Settings.",
      },
      {
        type: "callout",
        kind: "tip",
        label: "TIP",
        text: "Ending a session there and then changing your password logs that device out for good — it will need your new password to sign back in.",
      },
    ],
  },
  {
    number: "09",
    tag: "Conditional",
    title: "Interview Invitations",
    intro: "If you've been asked to sit on an interview panel.",
    blocks: [
      {
        type: "paragraph",
        text: "This chapter only applies if you've been asked to interview a candidate — it isn't a menu item that appears for everyone.",
      },
      {
        type: "paragraph",
        text: "If a recruiter adds you as a panelist on a scheduled interview, an Interviews item appears in your menu automatically (`/employee/interviews`). It lists your upcoming, completed, and cancelled interviews.",
      },
      {
        type: "steps",
        items: [
          "Open the interview to see the candidate's profile and role.",
          "After the interview, record your structured feedback — rating, recommendation, strengths, and concerns.",
          "The item disappears from your menu once you have no active panel assignments.",
        ],
      },
    ],
  },
  {
    number: "10",
    title: "Getting Help & FAQ",
    intro: "Common questions, answered.",
    blocks: [
      { type: "sectionHeading", text: "I forgot my password. What do I do?" },
      { type: "paragraph", text: "Use Forgot password on the login page, or ask HR to reset it for you." },
      { type: "sectionHeading", text: "I got an email asking me to approve a leave request — what is that?" },
      {
        type: "paragraph",
        text: "Occasionally, if you're named as an approver in someone's leave workflow, you'll receive a one-time secure link by email or Teams that lets you approve or reject directly — no login required. It expires after a set number of hours and can only be used once.",
      },
      { type: "sectionHeading", text: "Why can't I see a colleague's attendance or leave?" },
      {
        type: "paragraph",
        text: "Employee accounts only ever show your own records. Team visibility switches on once HR assigns direct reports to you in the org chart — see your line manager or HR if you believe you should have it.",
      },
      { type: "sectionHeading", text: "My regularization request has been pending a while — what now?" },
      { type: "paragraph", text: "Raise a ticket referencing the date in question; HR can look up the queue directly." },
      { type: "sectionHeading", text: "Who do I contact for anything not covered here?" },
      { type: "paragraph", text: "Raise a ticket from My Tickets — that's the fastest way to reach HR inside the system." },
    ],
  },
];
