"use client";

import Link from "next/link";
import { Zap, UserCheck, UserPlus, Headset, Upload, type LucideIcon } from "lucide-react";
import { Popover, usePopoverState } from "@/components/ui/popover";

type AdminQuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const ADMIN_ACTIONS: AdminQuickAction[] = [
  {
    label: "Review Pending Approvals",
    description: "Leave requests waiting on HR",
    href: "/admin/leaves",
    icon: UserCheck,
  },
  {
    label: "Add Employee",
    description: "Create a new employee record",
    href: "/admin/employees?create=1",
    icon: UserPlus,
  },
  {
    label: "Respond to Tickets",
    description: "Reply to open employee tickets",
    href: "/admin/tickets",
    icon: Headset,
  },
  {
    label: "Import Attendance Data",
    description: "Upload Excel or PDF attendance reports",
    href: "/admin/upload",
    icon: Upload,
  },
];

/**
 * HR/Super Admin top-bar counterpart to QuickActionsButton — same one-click
 * shortcut pattern, pointed at the admin tasks that recur daily instead of
 * the employee self-service ones.
 */
export function AdminQuickActionsButton() {
  const { open, setOpen, onOpenChange } = usePopoverState();

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Quick actions"
          title="Quick actions"
        >
          <Zap className="h-4 w-4" />
          <span className="hidden lg:inline">Quick actions</span>
        </button>
      }
      contentClassName="w-[min(100vw-1.5rem,20rem)]"
    >
      <div className="space-y-0.5">
        {ADMIN_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
          >
            <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium text-foreground">{a.label}</span>
              <span className="block text-xs text-muted-foreground">{a.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </Popover>
  );
}
