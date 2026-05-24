import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "employee") redirect("/login");

  return (
    <AppShell user={session} variant="wide">
      {children}
    </AppShell>
  );
}
