import type { LucideIcon } from "lucide-react";

export type SidebarLink = {
  href: string;
  label: string;
};

export type SidebarModule =
  | { kind: "link"; id: string; label: string; href: string; icon: LucideIcon }
  | {
      kind: "section";
      id: string;
      label: string;
      icon: LucideIcon;
      items: SidebarLink[];
      defaultOpen?: boolean;
    };

export type SidebarNav = {
  modules: SidebarModule[];
  footer: (SidebarLink & { icon: LucideIcon }) | null;
};

/** A section left with a single page renders as a plain row under the module name. */
export function section(
  id: string,
  label: string,
  icon: LucideIcon,
  items: SidebarLink[]
): SidebarModule | null {
  if (items.length === 0) return null;
  if (items.length === 1) return { kind: "link", id, label, href: items[0].href, icon };
  return { kind: "section", id, label, icon, items };
}

export function link(id: string, label: string, href: string, icon: LucideIcon): SidebarModule {
  return { kind: "link", id, label, href, icon };
}

export function compactModules(modules: (SidebarModule | null)[]): SidebarModule[] {
  return modules.filter((m): m is SidebarModule => m !== null);
}

export function sidebarHrefs(nav: SidebarNav): string[] {
  const hrefs = nav.modules.flatMap((m) =>
    m.kind === "link" ? [m.href] : m.items.map((item) => item.href)
  );
  return nav.footer ? [...hrefs, nav.footer.href] : hrefs;
}
