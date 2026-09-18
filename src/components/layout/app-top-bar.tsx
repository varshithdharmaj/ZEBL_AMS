import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { GlobalCommandPalette } from "@/components/search/global-command-palette";
import { QuickActionsButton } from "@/components/layout/quick-actions-button";
import { AdminQuickActionsButton } from "@/components/layout/admin-quick-actions-button";
import { NotificationCenterButton } from "@/components/layout/notification-center";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AccountMenu, type AccountMenuItem } from "@/components/layout/account-menu";

function HelpCenterButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Help Center"
      title="Help Center"
    >
      <HelpCircle className="h-4 w-4" />
    </Link>
  );
}

/**
 * Search has near-zero value for Employee/Manager (results are scoped to
 * just their own records — see global-search.ts) so that role gets
 * QuickActionsButton in this slot instead; HR/Super Admin keep search,
 * paired with AdminQuickActionsButton for their own one-click shortcuts.
 */
function PrimaryTopBarAction({
  showSearch,
  showApprovalsAction,
}: {
  showSearch: boolean;
  showApprovalsAction: boolean;
}) {
  return showSearch ? (
    <div className="flex items-center gap-2">
      <GlobalCommandPalette />
      <AdminQuickActionsButton />
    </div>
  ) : (
    <QuickActionsButton showApprovals={showApprovalsAction} />
  );
}

type TopBarProps = {
  helpHref: string;
  showSearch: boolean;
  showApprovalsAction: boolean;
  userName: string;
  email: string;
  roleLabel: string;
  accountMenuItems: AccountMenuItem[];
};

export function AppTopBar({
  helpHref,
  showSearch,
  showApprovalsAction,
  userName,
  email,
  roleLabel,
  accountMenuItems,
}: TopBarProps) {
  return (
    // pl-16 (vs. the pr-4/py-2 the rest of the bar uses) clears the fixed
    // mobile hamburger button (app-sidebar.tsx, left-4 top-4, h-10 w-10),
    // which would otherwise sit on top of this row's leading content.
    <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background py-2 pl-16 pr-4 lg:hidden">
      <PrimaryTopBarAction showSearch={showSearch} showApprovalsAction={showApprovalsAction} />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <HelpCenterButton href={helpHref} />
        <NotificationCenterButton />
        <AccountMenu userName={userName} email={email} roleLabel={roleLabel} items={accountMenuItems} />
      </div>
    </div>
  );
}

export function AppTopBarDesktop({
  helpHref,
  showSearch,
  showApprovalsAction,
  userName,
  email,
  roleLabel,
  accountMenuItems,
}: TopBarProps) {
  return (
    <div className="mb-6 hidden items-center justify-between gap-4 border-b border-border/80 pb-4 lg:flex">
      <PrimaryTopBarAction showSearch={showSearch} showApprovalsAction={showApprovalsAction} />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <HelpCenterButton href={helpHref} />
        <NotificationCenterButton />
        <AccountMenu userName={userName} email={email} roleLabel={roleLabel} items={accountMenuItems} />
      </div>
    </div>
  );
}
