"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  user,
  children,
  variant = "default",
}: {
  user: SessionUser;
  children: React.ReactNode;
  variant?: "default" | "wide";
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user.employeeName ?? user.email;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        role={user.role}
        userName={displayName}
        mobileOpen={mobileOpen}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="lg:pl-[var(--sidebar-width)]">
        <main
          className={
            variant === "wide"
              ? "min-h-screen w-full px-4 py-6 pt-[4.5rem] sm:px-6 lg:px-8 lg:py-8 lg:pt-8 xl:px-10"
              : "mx-auto min-h-screen w-full max-w-[var(--page-max)] px-5 py-8 pt-16 lg:px-10 lg:pt-10"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
