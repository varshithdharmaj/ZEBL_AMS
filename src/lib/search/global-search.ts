import { prisma } from "@/lib/prisma";
import { canAccessAdmin, isSuperAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export type SearchResultItem = {
  id: string;
  type: "employee" | "leave" | "audit" | "page";
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type AdminPageShortcut = { label: string; href: string; superAdminOnly?: boolean; keywords?: string[] };

// Kept in sync manually with the admin nav in app-sidebar.tsx (a "use client"
// component, so it can't be imported into this server-side search module).
const ADMIN_PAGE_SHORTCUTS: AdminPageShortcut[] = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Employees", href: "/admin/employees" },
  { label: "Attendance", href: "/admin/attendance" },
  { label: "Payroll Attendance", href: "/admin/payroll-attendance" },
  { label: "Leaves", href: "/admin/leaves", keywords: ["approval", "approvals"] },
  { label: "Calendar", href: "/admin/calendar" },
  { label: "Helpdesk", href: "/admin/tickets" },
  { label: "Upload Data", href: "/admin/upload" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Operations", href: "/admin/operations", keywords: ["worker", "workforce"] },
  { label: "Error Log", href: "/admin/operations/errors", keywords: ["error", "bug", "ref", "debug"] },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Integrations", href: "/admin/integrations" },
  { label: "Audit Log", href: "/admin/audit" },
  { label: "Security & Sessions", href: "/admin/security" },
  { label: "System Settings", href: "/admin/settings" },
  { label: "Payroll Settings", href: "/admin/payroll-settings" },
  { label: "Attendance Settings", href: "/admin/attendance-settings" },
  { label: "Shift Settings", href: "/admin/shift-settings" },
  { label: "Leave Settings", href: "/admin/leave-settings" },
  { label: "Leave Policy", href: "/admin/leave-policy" },
  { label: "User Guide", href: "/admin/help" },
  { label: "User Management", href: "/admin/user-management", superAdminOnly: true },
  { label: "Anonymous Tickets", href: "/admin/tickets/anonymous", superAdminOnly: true },
];

export async function globalSearch(
  session: SessionUser,
  query: string,
  limit = 20
): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const results: SearchResultItem[] = [];
  const isAdmin = canAccessAdmin(session.role);

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 8,
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: true,
    },
  });

  for (const e of employees) {
    if (!isAdmin && session.employeeId !== e.id) continue;
    results.push({
      id: `emp-${e.id}`,
      type: "employee",
      title: e.name,
      subtitle: `${e.employeeCode}${e.department ? ` · ${e.department}` : ""}`,
      href: isAdmin ? `/admin/employees/${e.id}` : "/employee/dashboard",
    });
  }

  if (isAdmin) {
    const lowerQ = q.toLowerCase();
    const canSeeSuperAdminPages = isSuperAdmin(session.role);
    for (const shortcut of ADMIN_PAGE_SHORTCUTS) {
      if (shortcut.superAdminOnly && !canSeeSuperAdminPages) continue;
      const haystacks = [shortcut.label, ...(shortcut.keywords ?? [])];
      if (!haystacks.some((h) => h.toLowerCase().includes(lowerQ))) continue;
      results.push({
        id: `page-${shortcut.href.slice(1).replace(/\//g, "-")}`,
        type: "page",
        title: shortcut.label,
        subtitle: "Admin",
        href: shortcut.href,
      });
    }
  }

  const textMatch = {
    OR: [
      { reason: { contains: q, mode: "insensitive" as const } },
      { employee: { name: { contains: q, mode: "insensitive" as const } } },
      { employee: { employeeCode: { contains: q, mode: "insensitive" as const } } },
    ],
  };
  // Non-admins see their own leaves plus their direct reports' (hierarchy-scoped).
  const scope = isAdmin
    ? {}
    : {
        OR: [
          { employeeId: session.employeeId ?? -1 },
          { employee: { managerId: session.employeeId ?? -1 } },
        ],
      };
  const leaveWhere = { AND: [textMatch, scope] };

  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true } } },
  });

  for (const l of leaves) {
    results.push({
      id: `leave-${l.id}`,
      type: "leave",
      title: `${l.employee.name} — ${l.leaveType}`,
      subtitle: l.workflowStatus.replace(/_/g, " "),
      href: isAdmin ? "/admin/leaves" : "/employee/leaves",
      meta: `${l.startDate.toISOString().slice(0, 10)}`,
    });
  }

  if (isAdmin) {
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q } },
          { actorEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    for (const a of audits) {
      results.push({
        id: `audit-${a.id}`,
        type: "audit",
        title: a.action,
        subtitle: `${a.entityType} / ${a.entityId}`,
        href: "/admin/audit",
      });
    }
  }

  return results.slice(0, limit);
}
