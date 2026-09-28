"use client";

import Link from "next/link";
import { Zap, CalendarPlus, Headset, ClipboardEdit, UserCheck, type LucideIcon } from "lucide-react";
import { Popover, usePopoverState } from "@/components/ui/popover";

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const BASE_ACTIONS: QuickAction[] = [
  {
    label: "Request Leave",
    description: "Submit a new leave request",
    href: "/employee/leaves#apply-for-leave",
    icon: CalendarPlus,
  },
  {
    label: "Raise a Ticket",
    description: "Get help from HR",
    href: "/employee/tickets/new",
    icon: Headset,
  },
  {
    label: "Request Attendance Correction",
    description: "Fix a missed or incorrect punch",
    href: "/employee/attendance#request-correction",
    icon: ClipboardEdit,
  },
];

const APPROVALS_ACTION: QuickAction = {
  label: "Review Approvals",
  description: "Leave requests waiting on you",
  href: "/employee/approvals",
  icon: UserCheck,
};

/**
 * Employee/Manager top-bar counterpart to GlobalCommandPalette — search has
 * near-zero value for this role (results are scoped to just their own
 * records), so this slot leads with the handful of actions they actually
 * repeat: request leave, raise a ticket, request a correction, and — once
 * they have direct reports — review approvals.
 */
export function QuickActionsButton({ showApprovals = false }: { showApprovals?: boolean }) {
  const { open, setOpen, onOpenChange } = usePopoverState();
  const actions = showApprovals ? [...BASE_ACTIONS, APPROVALS_ACTION] : BASE_ACTIONS;

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
        >
          <Zap className="h-4 w-4" />
          <span>Quick actions</span>
        </button>
      }
      contentClassName="w-[min(100vw-1.5rem,20rem)]"
    >
      <div className="space-y-0.5">
        {actions.map((a) => (
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
