"use client";

import { DateRangeFilter } from "@/components/ui/date-range-filter";

/** @deprecated Use DateRangeFilter — kept for backward-compatible imports */
export function MonthFilter({
  defaultMonth,
  label = "Date range",
}: {
  defaultMonth?: string;
  label?: string;
  paramName?: string;
}) {
  const today = new Date();
  const end = today.toISOString().split("T")[0];
  const start =
    defaultMonth && /^\d{4}-\d{2}$/.test(defaultMonth)
      ? `${defaultMonth}-01`
      : new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

  return (
    <DateRangeFilter
      defaultStart={start}
      defaultEnd={end}
      layout="default"
      showPresets
    />
  );
}
