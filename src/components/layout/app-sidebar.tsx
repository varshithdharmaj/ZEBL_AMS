"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLinkPendingHint } from "@/components/layout/nav-link-pending-hint";
import type { AppUserRole } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import { getRoleHomePath } from "@/lib/routing";
import { buildAdminShellNav, buildRecruitmentOpsNav } from "@/lib/navigation/admin-shell-nav";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";
import {
  sidebarHrefs,
  type SidebarModule,
  type SidebarNav,
} from "@/lib/navigation/sidebar-nav-types";
import { findActiveSidebarHref } from "@/lib/recruitment/navigation/sidebar-nav-active";

const OPEN_SECTIONS_STORAGE_KEY = "hrms.sidebar.openSections";

function navForRole(
  role: AppUserRole,
  showMyTeamGroup: boolean,
  showRecruitmentNav: boolean,
  showPanelistInterviews: boolean,
  recruitmentOpsOnly: boolean,
  showOwnWorkspaceNav: boolean
): SidebarNav {
  if (recruitmentOpsOnly) return buildRecruitmentOpsNav();
  if (role === "super_admin" || role === "hr") {
    return buildAdminShellNav({ role, showRecruitmentNav, showOwnWorkspaceNav });
  }
  return buildEmployeeShellNav(showMyTeamGroup, showPanelistInterviews, showRecruitmentNav);
}

function readOpenSections(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(OPEN_SECTIONS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
  } catch {
    return {};
  }
}

function ActiveMarker() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-blue-600 dark:bg-blue-400"
    />
  );
}

const rowBase =
  "relative flex w-full items-center gap-3 rounded-lg text-left transition-colors duration-150";
const rowIdle = "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";

export function AppSidebar({
  role,
  collapsed = false,
  onToggleCollapse,
  showMyTeamGroup = false,
  showRecruitmentNav = false,
  showPanelistInterviews = false,
  recruitmentOpsOnly = false,
  showOwnWorkspaceNav = false,
  roleLabel,
}: {
  role: AppUserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Line-manager My Team section (from MyTeamNavContext.showMyTeamGroup). */
  showMyTeamGroup?: boolean;
  /** Admin: Recruitment nav (RECRUITMENT_MODULE_ENABLED). */
  showRecruitmentNav?: boolean;
  /** Employee: Interviews nav when assigned as a panelist (and recruitment is on). */
  showPanelistInterviews?: boolean;
  /** Recruitment test managers: Hiring Workspace only. */
  recruitmentOpsOnly?: boolean;
  /** HR/Super Admin linked to an Employee record: "My Workspace" section. */
  showOwnWorkspaceNav?: boolean;
  /** Label under the logo; defaults to the login role's label. */
  roleLabel?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const nav = useMemo(
    () =>
      navForRole(
        role,
        showMyTeamGroup,
        showRecruitmentNav,
        showPanelistInterviews,
        recruitmentOpsOnly,
        showOwnWorkspaceNav
      ),
    [role, showMyTeamGroup, showRecruitmentNav, showPanelistInterviews, recruitmentOpsOnly, showOwnWorkspaceNav]
  );
  const activeHref = findActiveSidebarHref(pathname, sidebarHrefs(nav));
  const activeSectionId =
    nav.modules.find(
      (m) => m.kind === "section" && m.items.some((item) => item.href === activeHref)
    )?.id ?? null;

  const home = recruitmentOpsOnly ? "/admin/recruitment" : getRoleHomePath(role);
  const onMobileClose = () => setMobileOpen(false);

  useEffect(() => {
    setOpenSections(readOpenSections());
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded || !activeSectionId) return;
    setOpenSections((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
  }, [activeSectionId, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      window.localStorage.setItem(OPEN_SECTIONS_STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // Storage can be unavailable (private mode); open sections just won't persist.
    }
  }, [openSections, storageLoaded]);

  useEffect(() => {
    setFlyout(null);
  }, [pathname, collapsed]);

  useEffect(() => {
    if (!flyout) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (flyoutRef.current?.contains(target)) return;
      if ((target as Element).closest?.(`[data-sidebar-section="${flyout.id}"]`)) return;
      setFlyout(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlyout(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flyout]);

  const isSectionOpen = (module: Extract<SidebarModule, { kind: "section" }>) =>
    openSections[module.id] ?? (module.defaultOpen === true || module.id === activeSectionId);

  const onSectionClick = (
    module: Extract<SidebarModule, { kind: "section" }>,
    button: HTMLButtonElement
  ) => {
    const railMode = collapsed && window.matchMedia("(min-width: 1024px)").matches;
    if (railMode) {
      const rect = button.getBoundingClientRect();
      const menuHeight = module.items.length * 40 + 48;
      const top = Math.min(rect.top, window.innerHeight - menuHeight - 8);
      setFlyout((current) => (current?.id === module.id ? null : { id: module.id, top }));
      return;
    }
    setOpenSections((prev) => ({ ...prev, [module.id]: !isSectionOpen(module) }));
  };

  const flyoutModule =
    flyout && nav.modules.find((m) => m.id === flyout.id && m.kind === "section");

  const labelClass = cn(
    "truncate transition-opacity duration-200",
    collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
  );
  const iconClass = (highlighted: boolean) =>
    cn(
      "shrink-0",
      collapsed ? "h-5 w-5 lg:h-[22px] lg:w-[22px]" : "h-5 w-5",
      highlighted ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
    );
  const moduleRowClass = (state: "active" | "within" | "idle") =>
    cn(
      rowBase,
      "h-11 text-[15px]",
      collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
      state === "active" && "bg-sidebar-accent font-semibold text-foreground",
      state === "within" && "font-semibold text-foreground hover:bg-sidebar-accent",
      state === "idle" && cn("font-medium", rowIdle)
    );

  const renderLinkRow = (
    key: string,
    href: string,
    label: string,
    Icon: Extract<SidebarModule, { kind: "link" }>["icon"]
  ) => {
    const active = activeHref === href;
    return (
      <Link
        key={key}
        href={href}
        onClick={onMobileClose}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={moduleRowClass(active ? "active" : "idle")}
      >
        {active ? <ActiveMarker /> : null}
        <Icon className={iconClass(active)} />
        <span className={labelClass}>{label}</span>
        <NavLinkPendingHint collapsed={collapsed} />
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-card text-foreground shadow-subtle lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close overlay"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-300 ease-in-out lg:translate-x-0",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-5",
            collapsed && "lg:justify-center lg:px-0"
          )}
        >
          <Link
            href={home}
            className={cn("flex items-center gap-2.5 overflow-hidden", collapsed && "lg:hidden")}
            onClick={onMobileClose}
          >
            <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-sm font-black text-white shadow-subtle">
              Z
            </span>
            <div
              className={cn(
                "transition-opacity duration-200 whitespace-nowrap",
                collapsed ? "lg:hidden lg:opacity-0" : "opacity-100"
              )}
            >
              <p className="text-sm font-bold leading-tight tracking-tight text-foreground">HRMS</p>
              <p className="text-[0.65rem] font-medium text-muted-foreground">{roleLabel ?? ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <button type="button" className="lg:hidden" onClick={onMobileClose} aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {nav.modules.map((module) => {
            if (module.kind === "link") {
              return renderLinkRow(module.id, module.href, module.label, module.icon);
            }

            const open = isSectionOpen(module);
            const within = module.id === activeSectionId;
            const Icon = module.icon;
            const panelId = `sidebar-section-${module.id}`;
            return (
              <div key={module.id}>
                <button
                  type="button"
                  data-sidebar-section={module.id}
                  onClick={(event) => onSectionClick(module, event.currentTarget)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  title={collapsed ? module.label : undefined}
                  className={moduleRowClass(
                    within && (!open || collapsed) ? "within" : "idle"
                  )}
                >
                  {within && collapsed ? <ActiveMarker /> : null}
                  <Icon className={iconClass(within)} />
                  <span className={cn(labelClass, "flex-1")}>{module.label}</span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      open ? "rotate-0" : "-rotate-90",
                      collapsed && "lg:hidden"
                    )}
                  />
                </button>
                {open ? (
                  <ul
                    id={panelId}
                    className={cn(
                      "mb-1 ml-[22px] mt-1 space-y-1 border-l border-sidebar-border pl-3",
                      collapsed && "lg:hidden"
                    )}
                  >
                    {module.items.map((item) => {
                      const active = activeHref === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onMobileClose}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              rowBase,
                              "h-9 px-3 text-sm",
                              active ? "bg-sidebar-accent font-semibold text-foreground" : rowIdle
                            )}
                          >
                            {active ? <ActiveMarker /> : null}
                            <span className="truncate">{item.label}</span>
                            <NavLinkPendingHint collapsed={false} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </nav>

        {nav.footer ? (
          <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
            {renderLinkRow("footer", nav.footer.href, nav.footer.label, nav.footer.icon)}
          </div>
        ) : null}
      </aside>

      {flyout && flyoutModule && flyoutModule.kind === "section" ? (
        <div
          ref={flyoutRef}
          role="menu"
          aria-label={flyoutModule.label}
          className="fixed left-[5.5rem] z-[60] hidden w-56 rounded-xl border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground shadow-lg lg:block"
          style={{ top: Math.max(8, flyout.top - 4) }}
        >
          <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {flyoutModule.label}
          </p>
          {flyoutModule.items.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setFlyout(null)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  rowBase,
                  "h-9 px-3 text-sm",
                  active ? "bg-sidebar-accent font-semibold text-foreground" : rowIdle
                )}
              >
                {active ? <ActiveMarker /> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
