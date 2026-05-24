"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function MonthFilter({
  paramName = "month",
  defaultMonth,
  label = "Month",
}: {
  paramName?: string;
  defaultMonth: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? defaultMonth;

  return (
    <div className="flex flex-col gap-1.5 max-w-xs">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="month"
        value={current}
        onChange={(e) => {
          const p = new URLSearchParams(searchParams.toString());
          if (e.target.value) p.set(paramName, e.target.value);
          else p.delete(paramName);
          router.push(`${pathname}?${p.toString()}`);
        }}
        className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}
