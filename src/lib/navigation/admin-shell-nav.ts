import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  Fingerprint,
  Headset,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { AppUserRole } from "@/lib/roles";
import {
  compactModules,
  link,
  section,
  type SidebarLink,
  type SidebarNav,
} from "@/lib/navigation/sidebar-nav-types";

export type AdminShellNavOptions = {
  role: Extract<AppUserRole, "hr" | "super_admin">;
  showRecruitmentNav: boolean;
  showOwnWorkspaceNav: boolean;
};

export const RECRUITMENT_WORKSPACE_LINKS: SidebarLink[] = [
  { href: "/admin/recruitment", label: "Dashboard" },
  { href: "/admin/recruitment/jobs", label: "Jobs" },
  { href: "/admin/recruitment/candidates", label: "Candidates" },
  { href: "/admin/recruitment/pipeline", label: "Pipeline" },
  { href: "/admin/recruitment/offers", label: "Offers" },
  { href: "/admin/recruitment/conversions", label: "Conversions" },
  { href: "/admin/recruitment/reports", label: "Reports" },
];

/** One row per module for HR and Super Admin; settings sit inside their module. */
export function buildAdminShellNav({
  role,
  showRecruitmentNav,
  showOwnWorkspaceNav,
}: AdminShellNavOptions): SidebarNav {
  const superAdmin = role === "super_admin";

  return {
    modules: compactModules([
      link("dashboard", "Dashboard", "/admin/dashboard", LayoutDashboard),
      link("employees", "Employees", "/admin/employees", Users),
      section("attendance", "Attendance", Fingerprint, [
        { href: "/admin/attendance", label: "Attendance" },
        { href: "/admin/upload", label: "Upload Attendance" },
        { href: "/admin/attendance-settings", label: "Attendance Settings" },
        { href: "/admin/shift-settings", label: "Shift Settings" },
      ]),
      section("leave", "Leave", CalendarDays, [
        { href: "/admin/leaves", label: "Leaves" },
        { href: "/admin/calendar", label: "Leave Calendar" },
        { href: "/admin/leave-policy", label: "Leave Policy" },
        { href: "/admin/leave-settings", label: "Leave Settings" },
      ]),
      section("payroll", "Payroll", Wallet, [
        { href: "/admin/payroll-attendance", label: "Payroll Attendance" },
        { href: "/admin/payroll-settings", label: "Payroll Settings" },
      ]),
      showRecruitmentNav
        ? section("recruitment", "Recruitment", BriefcaseBusiness, [
            ...RECRUITMENT_WORKSPACE_LINKS,
            { href: "/admin/recruitment/settings", label: "Settings" },
          ])
        : null,
      section("helpdesk", "Helpdesk", Headset, [
        { href: "/admin/tickets", label: "Tickets" },
        ...(superAdmin ? [{ href: "/admin/tickets/anonymous", label: "Anonymous Tickets" }] : []),
      ]),
      showOwnWorkspaceNav
        ? section("my-workspace", "My Workspace", UserRound, [
            { href: "/employee/dashboard", label: "My Dashboard" },
            { href: "/employee/attendance", label: "My Attendance" },
            { href: "/employee/leaves", label: "My Leaves" },
          ])
        : null,
      section("monitoring", "Monitoring", Activity, [
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/operations", label: "Operations" },
        { href: "/admin/operations/errors", label: "Error Log" },
        { href: "/admin/notifications", label: "Notifications" },
        { href: "/admin/audit", label: "Audit Log" },
      ]),
      section("administration", "Administration", ShieldCheck, [
        { href: "/admin/settings", label: "System Settings" },
        { href: "/admin/integrations", label: "Integrations" },
        { href: "/admin/security", label: "Security & Sessions" },
        ...(superAdmin ? [{ href: "/admin/user-management", label: "User Management" }] : []),
      ]),
    ]),
    footer: { href: "/admin/help", label: "User Guide", icon: CircleHelp },
  };
}

/** Recruitment test managers: their existing nine links, unchanged. */
export function buildRecruitmentOpsNav(): SidebarNav {
  return {
    modules: [
      {
        kind: "section",
        id: "recruitment",
        label: "Hiring Workspace",
        icon: BriefcaseBusiness,
        items: RECRUITMENT_WORKSPACE_LINKS,
        defaultOpen: true,
      },
      link("employee-home", "Employee Home", "/employee/dashboard", LayoutDashboard),
      link("profile", "Profile", "/employee/profile", UserRound),
    ],
    footer: null,
  };
}
