import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";
import { canAccessManagerShell } from "@/lib/permissions";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessManagerShell(session.role)) redirect("/login");

  return (
    <AppShell user={session} variant="wide">
      {children}
    </AppShell>
  );
}
