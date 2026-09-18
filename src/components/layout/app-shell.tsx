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
import { getMyTeamNavContextAction } from "@/actions/employee-nav";

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
  /**
   * Employee shell: resolve My Team nav after first paint so the layout
   * does not block on eligibility (presentation-only).
   */
  deferMyTeamNav = false,
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
  deferMyTeamNav?: boolean;
  recruitmentOpsOnly?: boolean;
  showOwnWorkspaceNav?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [myTeamVisible, setMyTeamVisible] = useState(
    deferMyTeamNav ? false : showMyTeamGroup
  );
  const displayName = user.employeeName ?? user.email;
  const isAdminShell = canAccessAdmin(user.role);
  const helpHref = isAdminShell ? "/admin/help" : "/employee/help";
  const accountMenuItems: AccountMenuItem[] = isAdminShell
    ? showOwnWorkspaceNav
      ? [PROFILE_ITEM]
      : []
    : EMPLOYEE_SHELL_ACCOUNT_ITEMS;

  useEffect(() => {
    if (!deferMyTeamNav) {
      setMyTeamVisible(showMyTeamGroup);
      return;
    }
    let cancelled = false;
    void getMyTeamNavContextAction()
      .then((ctx) => {
        if (!cancelled) setMyTeamVisible(ctx?.showMyTeamGroup ?? false);
      })
      .catch(() => {
        if (!cancelled) setMyTeamVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deferMyTeamNav, showMyTeamGroup]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        role={user.role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        showMyTeamGroup={myTeamVisible}
        showRecruitmentNav={showRecruitmentNav}
        showPanelistInterviews={showPanelistInterviews}
        recruitmentOpsOnly={recruitmentOpsOnly}
        showOwnWorkspaceNav={showOwnWorkspaceNav}
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
          roleLabel={ROLE_LABELS[user.role]}
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
            roleLabel={ROLE_LABELS[user.role]}
            accountMenuItems={accountMenuItems}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
