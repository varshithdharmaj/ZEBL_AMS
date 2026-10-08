import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  Headset,
  History,
  LayoutDashboard,
  UserRound,
  Users,
} from "lucide-react";
import {
  compactModules,
  link,
  section,
  type SidebarNav,
} from "@/lib/navigation/sidebar-nav-types";

/**
 * Employee and manager sidebar. Settings and Security & Sessions live in the
 * account menu; My Team appears only when {@link showMyTeamGroup} is true.
 */
export function buildEmployeeShellNav(
  showMyTeamGroup: boolean,
  showPanelistInterviews = false,
  showRecruitmentOpsLink = false
): SidebarNav {
  // Prefer the full Recruitment workspace when present — avoid a duplicate Interviews entry.
  const hiringLink = showRecruitmentOpsLink
    ? link("recruitment", "Recruitment", "/admin/recruitment", BriefcaseBusiness)
    : showPanelistInterviews
      ? link("interviews", "Interviews", "/employee/interviews", BriefcaseBusiness)
      : null;

  return {
    modules: compactModules([
      link("dashboard", "Dashboard", "/employee/dashboard", LayoutDashboard),
      link("profile", "Profile", "/employee/profile", UserRound),
      hiringLink,
      link("history", "History", "/employee/attendance", History),
      link("leaves", "Leaves", "/employee/leaves", CalendarDays),
      link("leave-policy", "Leave Policy", "/employee/leaves/policy", BookOpen),
      link("tickets", "My Tickets", "/employee/tickets", Headset),
      showMyTeamGroup
        ? section("my-team", "My Team", Users, [
            { href: "/employee/team", label: "Overview" },
            { href: "/employee/approvals", label: "Approvals" },
            { href: "/employee/team/people", label: "People" },
            { href: "/employee/team/attendance", label: "Attendance" },
            { href: "/employee/team/leave", label: "Leave" },
            { href: "/employee/team/calendar", label: "Calendar" },
          ])
        : null,
    ]),
    footer: { href: "/employee/help", label: "User Guide", icon: CircleHelp },
  };
}
