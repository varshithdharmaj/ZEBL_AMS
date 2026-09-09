import type { HelpChapter, HelpGuideMeta, HelpRole } from "@/lib/help/types";
import { hrHelpChapters } from "@/lib/help/content/hr";
import { superAdminHelpChapters } from "@/lib/help/content/super-admin";
import { employeeHelpChapters } from "@/lib/help/content/employee";
import { managerHelpChapters } from "@/lib/help/content/manager";

export const HELP_GUIDE_META: Record<HelpRole, HelpGuideMeta> = {
  hr: {
    role: "hr",
    roleLabel: "HR",
    accent: "blue",
    coverDescription:
      "Workforce administration end to end — employees, attendance, payroll attendance, leave, recruitment, tickets, and the operational tools behind them.",
    edition: "HR Edition",
  },
  super_admin: {
    role: "super_admin",
    roleLabel: "Super Admin",
    accent: "purple",
    coverDescription:
      "Full platform administration — everything in the HR workspace, plus user & role management, anonymous tickets, and the settings only this role can change.",
    edition: "Super Admin Edition",
  },
  manager: {
    role: "manager",
    roleLabel: "Manager",
    accent: "teal",
    coverDescription:
      "Your own attendance and leave, plus the tools to lead your team — approvals, team attendance, and team calendar.",
    edition: "Manager Edition",
  },
  employee: {
    role: "employee",
    roleLabel: "Employee",
    accent: "teal",
    coverDescription:
      "Everything you need to mark your day, request leave, fix an attendance mistake, and get help — from your own dashboard.",
    edition: "Employee Edition",
  },
};

/**
 * Chapters for a given role. `isLineManager` mirrors the same signal the
 * sidebar's "My Team" nav group uses (resolveMyTeamNavContext) — a manager
 * with no active direct reports sees the plain Employee guide, matching what
 * their menu actually looks like.
 */
export function getHelpChapters(role: HelpRole, isLineManager = false): HelpChapter[] {
  switch (role) {
    case "hr":
      return hrHelpChapters;
    case "super_admin":
      return superAdminHelpChapters;
    case "manager":
      return isLineManager ? managerHelpChapters : employeeHelpChapters;
    case "employee":
    default:
      return employeeHelpChapters;
  }
}
