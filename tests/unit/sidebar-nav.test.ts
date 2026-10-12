import { describe, expect, it } from "vitest";
import { buildAdminShellNav, buildRecruitmentOpsNav } from "@/lib/navigation/admin-shell-nav";
import { buildEmployeeShellNav } from "@/lib/navigation/employee-shell-nav";
import { sidebarHrefs } from "@/lib/navigation/sidebar-nav-types";
import { findActiveSidebarHref } from "@/lib/recruitment/navigation/sidebar-nav-active";

const ADMIN_PAGES = [
  "/admin/dashboard",
  "/admin/employees",
  "/admin/attendance",
  "/admin/payroll-attendance",
  "/admin/leaves",
  "/admin/calendar",
  "/admin/tickets",
  "/admin/upload",
  "/admin/analytics",
  "/admin/operations",
  "/admin/operations/errors",
  "/admin/notifications",
  "/admin/integrations",
  "/admin/audit",
  "/admin/security",
  "/admin/settings",
  "/admin/payroll-settings",
  "/admin/attendance-settings",
  "/admin/shift-settings",
  "/admin/leave-settings",
  "/admin/leave-policy",
  "/admin/help",
];
const RECRUITMENT_PAGES = [
  "/admin/recruitment",
  "/admin/recruitment/batches",
  "/admin/recruitment/jobs",
  "/admin/recruitment/candidates",
  "/admin/recruitment/pipeline",
  "/admin/recruitment/offers",
  "/admin/recruitment/conversions",
  "/admin/recruitment/reports",
  "/admin/recruitment/settings",
];
const SUPER_ADMIN_ONLY = ["/admin/user-management", "/admin/tickets/anonymous"];
const OWN_WORKSPACE = ["/employee/dashboard", "/employee/attendance", "/employee/leaves"];

const sorted = (hrefs: string[]) => [...hrefs].sort();

describe("admin sidebar", () => {
  it("keeps every Super Admin page, each exactly once", () => {
    const hrefs = sidebarHrefs(
      buildAdminShellNav({ role: "super_admin", showRecruitmentNav: true, showOwnWorkspaceNav: true })
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(sorted(hrefs)).toEqual(
      sorted([...ADMIN_PAGES, ...RECRUITMENT_PAGES, ...SUPER_ADMIN_ONLY, ...OWN_WORKSPACE])
    );
  });

  it("hides Super Admin-only pages from HR", () => {
    const hrefs = sidebarHrefs(
      buildAdminShellNav({ role: "hr", showRecruitmentNav: true, showOwnWorkspaceNav: false })
    );
    for (const href of SUPER_ADMIN_ONLY) expect(hrefs).not.toContain(href);
    expect(sorted(hrefs)).toEqual(sorted([...ADMIN_PAGES, ...RECRUITMENT_PAGES]));
  });

  it("drops Recruitment and My Workspace when their flags are off", () => {
    const nav = buildAdminShellNav({ role: "hr", showRecruitmentNav: false, showOwnWorkspaceNav: false });
    const ids = nav.modules.map((m) => m.id);
    expect(ids).not.toContain("recruitment");
    expect(ids).not.toContain("my-workspace");
  });

  it("shows a single-page Helpdesk as a plain row for HR", () => {
    const nav = buildAdminShellNav({ role: "hr", showRecruitmentNav: false, showOwnWorkspaceNav: false });
    expect(nav.modules.find((m) => m.id === "helpdesk")).toMatchObject({
      kind: "link",
      href: "/admin/tickets",
    });
  });

  it("keeps the Super Admin menu to 11 rows including User Guide", () => {
    const nav = buildAdminShellNav({ role: "super_admin", showRecruitmentNav: true, showOwnWorkspaceNav: true });
    expect(nav.modules.length + (nav.footer ? 1 : 0)).toBe(11);
  });
});

describe("employee sidebar", () => {
  it("is flat with User Guide in the footer", () => {
    const nav = buildEmployeeShellNav(false);
    expect(nav.modules.every((m) => m.kind === "link")).toBe(true);
    expect(nav.footer?.href).toBe("/employee/help");
    expect(sidebarHrefs(nav)).not.toContain("/employee/settings");
  });

  it("folds My Team into one section for managers", () => {
    const nav = buildEmployeeShellNav(true);
    const myTeam = nav.modules.find((m) => m.id === "my-team");
    expect(myTeam?.kind).toBe("section");
    expect(nav.modules.filter((m) => m.kind === "section")).toHaveLength(1);
  });

  it("prefers the Recruitment link over Interviews", () => {
    const hrefs = sidebarHrefs(buildEmployeeShellNav(false, true, true));
    expect(hrefs).toContain("/admin/recruitment");
    expect(hrefs).not.toContain("/employee/interviews");
  });
});

describe("recruitment test manager sidebar", () => {
  it("keeps the same nine links", () => {
    expect(sidebarHrefs(buildRecruitmentOpsNav())).toEqual([
      ...RECRUITMENT_PAGES.filter((href) => href !== "/admin/recruitment/settings"),
      "/employee/dashboard",
      "/employee/profile",
    ]);
  });
});

describe("findActiveSidebarHref", () => {
  const admin = sidebarHrefs(
    buildAdminShellNav({ role: "super_admin", showRecruitmentNav: true, showOwnWorkspaceNav: false })
  );
  const manager = sidebarHrefs(buildEmployeeShellNav(true));

  it.each([
    ["/admin/operations/errors", "/admin/operations/errors"],
    ["/admin/operations", "/admin/operations"],
    ["/admin/tickets/anonymous", "/admin/tickets/anonymous"],
    ["/admin/tickets/abc", "/admin/tickets"],
    ["/admin/recruitment/applications/abc", "/admin/recruitment/pipeline"],
    ["/admin/recruitment/jobs/new", "/admin/recruitment/jobs"],
    ["/admin/attendance-settings", "/admin/attendance-settings"],
  ])("admin %s -> %s", (path, expected) => {
    expect(findActiveSidebarHref(path, admin)).toBe(expected);
  });

  it("does not highlight Recruitment Dashboard on child pages", () => {
    expect(findActiveSidebarHref("/admin/recruitment/unknown", admin)).toBeNull();
  });

  it.each([
    ["/employee/leaves/policy", "/employee/leaves/policy"],
    ["/employee/leaves", "/employee/leaves"],
    ["/employee/team/people/emp-1", "/employee/team/people"],
    ["/employee/team", "/employee/team"],
  ])("manager %s -> %s", (path, expected) => {
    expect(findActiveSidebarHref(path, manager)).toBe(expected);
  });
});
