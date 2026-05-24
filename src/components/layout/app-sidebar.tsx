"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Users,
  ClipboardList,
  CalendarDays,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/upload", label: "Upload", icon: Upload },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarDays },
];

const employeeNav: NavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/attendance", label: "History", icon: History },
  { href: "/employee/leaves", label: "Leaves", icon: CalendarDays },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AppSidebar({
  role,
  userName,
  mobileOpen,
  onMobileOpen,
  onMobileClose,
}: {
  role: "admin" | "employee";
  userName: string;
  mobileOpen: boolean;
  onMobileOpen: () => void;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const nav = role === "admin" ? adminNav : employeeNav;
  const home = role === "admin" ? "/admin/dashboard" : "/employee/dashboard";

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-card text-foreground shadow-card lg:hidden"
        onClick={onMobileOpen}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[2px] lg:hidden"
          onClick={onMobileClose}
          aria-label="Close overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar",
          "transition-transform duration-200 ease-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[4.25rem] items-center gap-3 px-5">
          <Link
            href={home}
            className="flex items-center gap-3"
            onClick={onMobileClose}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-subtle">
              Z
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">Zebl</p>
              <p className="text-[0.6875rem] text-muted-foreground">Attendance</p>
            </div>
          </Link>
          <button
            type="button"
            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={onMobileClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {role === "admin" ? "Admin" : "Menu"}
          </p>
          <ul className="space-y-1">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium transition-all",
                      active
                        ? "bg-sidebar-accent text-primary shadow-subtle"
                        : "text-sidebar-foreground hover:bg-white hover:shadow-subtle"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[1.125rem] w-[1.125rem] shrink-0",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-subtle">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary">
              {initials(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{role}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
