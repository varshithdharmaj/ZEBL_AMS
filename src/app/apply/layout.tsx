import Link from "next/link";
import type { Metadata } from "next";
import { ZeblMark } from "@/components/brand/zebl-mark";

export const metadata: Metadata = {
  title: { template: "%s · ZEBL Careers", default: "ZEBL Careers" },
};

/** Branded shell for the candidate-facing career portal (/apply, /apply/[slug]). */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link href="/apply" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <ZeblMark />
            <span className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-foreground">ZEBL</span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Careers</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border">
        <p className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ZEBL India Private Limited
        </p>
      </footer>
    </div>
  );
}
