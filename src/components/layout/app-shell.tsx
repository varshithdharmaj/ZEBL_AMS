"use client";

import { useState, useEffect } from "react";
import { UserRound, Settings, ShieldCheck } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopBar, AppTopBarDesktop } from "@/components/layout/app-top-bar";
import type { AccountMenuItem } from "@/components/layout/account-menu";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { canAccessAdmin } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";

const COLLAPSED_STORAGE_KEY = "hrms.sidebar.collapsed";

const PROFILE_ITEM: AccountMenuItem = { label: "My Profile", href: "/employee/profile", icon: UserRound };

// Employee/Manager: personal account settings live in the dropdown, not the
// sidebar. HR/Super Admin's Settings/Security are org-wide admin tools, not
// personal ones, so those stay in the sidebar — only My Profile moves.
const EMPLOYEE_SHELL_ACCOUNT_ITEMS: AccountMenuItem[] = [
  PROFILE_ITEM,
  { label: "Settings", href: "/employee/settings", icon: Settings },
  { label: "Security & Sessions", href: "/employee/security", icon: ShieldCheck },
];

export function AppShell({
  user,
  children,
  variant = "default",
  showMyTeamGroup = false,
  showRecruitmentNav = false,
  showPanelistInterviews = false,
  /** Recruitment test managers: Hiring Workspace only (no other /admin nav). */
  recruitmentOpsOnly = false,
  /** HR/Super Admin linked to an Employee record: "My Workspace" nav group. */
  showOwnWorkspaceNav = false,
}: {
  user: SessionUser;
  children: React.ReactNode;
  variant?: "default" | "wide";
  showMyTeamGroup?: boolean;
  /** Admin: Recruitment sidebar entry (feature-flag gated). */
  showRecruitmentNav?: boolean;
  /** Employee: Interviews nav when recruitment module is enabled. */
  showPanelistInterviews?: boolean;
  recruitmentOpsOnly?: boolean;
  showOwnWorkspaceNav?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const myTeamVisible = showMyTeamGroup;
  const displayName = user.employeeName ?? user.email;
  const isAdminShell = canAccessAdmin(user.role);
  const helpHref = isAdminShell ? "/admin/help" : "/employee/help";
  const accountMenuItems: AccountMenuItem[] = isAdminShell
    ? showOwnWorkspaceNav
      ? [PROFILE_ITEM]
      : []
    : EMPLOYEE_SHELL_ACCOUNT_ITEMS;
  // Line managers usually log in with the "employee" role; having direct
  // reports (the same signal as the My Team nav and the help guide) makes
  // them a Manager in what we show.
  const roleLabel =
    !isAdminShell && myTeamVisible ? ROLE_LABELS.manager : ROLE_LABELS[user.role];

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
    } catch {
      // Storage unavailable: keep the expanded default.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Storage unavailable: the choice lasts for this page only.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        role={user.role}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        showMyTeamGroup={myTeamVisible}
        showRecruitmentNav={showRecruitmentNav}
        showPanelistInterviews={showPanelistInterviews}
        recruitmentOpsOnly={recruitmentOpsOnly}
        showOwnWorkspaceNav={showOwnWorkspaceNav}
        roleLabel={roleLabel}
      />
      <div
        className={cn(
          "min-w-0 max-w-full overflow-x-hidden transition-[padding] duration-300 ease-in-out",
          collapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <AppTopBar
          helpHref={helpHref}
          showSearch={isAdminShell}
          showApprovalsAction={myTeamVisible}
          userName={displayName}
          email={user.email}
          roleLabel={roleLabel}
          accountMenuItems={accountMenuItems}
        />
        <main
          className={
            variant === "wide"
              ? "min-h-screen w-full min-w-0 max-w-full px-4 py-6 pt-[4.5rem] sm:px-6 lg:px-8 lg:py-8 lg:pt-8 xl:px-10"
              : "mx-auto min-h-screen w-full min-w-0 max-w-[var(--page-max)] px-5 py-8 pt-16 lg:px-10 lg:pt-10"
          }
        >
          <AppTopBarDesktop
            helpHref={helpHref}
            showSearch={isAdminShell}
            showApprovalsAction={myTeamVisible}
            userName={displayName}
            email={user.email}
            roleLabel={roleLabel}
            accountMenuItems={accountMenuItems}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
