import { cn } from "@/lib/utils";

/** The ZEBL "Z" mark — same artwork as src/app/icon.svg, inlined so it renders
 * without a network request on public (logged-out) pages. */
export function ZeblMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("h-9 w-9 shrink-0", className)}>
      <defs>
        <linearGradient id="zebl-mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="#0F172A" />
      <path d="M 22 26 H 62 L 36 64 H 78 V 74 H 22 L 48 36 H 22 Z" fill="url(#zebl-mark-grad)" />
      <rect x="68" y="26" width="9" height="9" rx="2" fill="url(#zebl-mark-grad)" />
      <rect x="80" y="26" width="6" height="6" rx="1.5" fill="url(#zebl-mark-grad)" opacity="0.9" />
      <rect x="80" y="35" width="6" height="6" rx="1.5" fill="url(#zebl-mark-grad)" opacity="0.9" />
    </svg>
  );
}
