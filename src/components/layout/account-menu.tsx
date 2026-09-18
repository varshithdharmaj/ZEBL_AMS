"use client";

import Link from "next/link";
import { LogOut, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Popover, usePopoverState } from "@/components/ui/popover";

export type AccountMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Single account entry point (avatar → dropdown), replacing what used to be
 * a sidebar-bottom card duplicating the "Profile" nav item plus a separate
 * always-visible sign-out button. One place for profile/settings/security/
 * sign-out, matching the top-right account menu pattern most HRMS use
 * (Workday, BambooHR, Gusto, Zoho) instead of a second, competing nav path.
 */
export function AccountMenu({
  userName,
  email,
  roleLabel,
  items,
}: {
  userName: string;
  email: string;
  roleLabel: string;
  items: AccountMenuItem[];
}) {
  const { open, setOpen, onOpenChange } = usePopoverState();

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      trigger={
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background transition-opacity hover:opacity-90"
          aria-label={`Account menu for ${userName}`}
        >
          {initials(userName)}
        </button>
      }
      contentClassName="w-64 p-0"
    >
      <div className="border-b border-border px-3.5 py-3">
        <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          {roleLabel}
        </p>
      </div>

      {items.length > 0 && (
        <div className="border-b border-border p-1.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <div className="p-1.5">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </Popover>
  );
}
