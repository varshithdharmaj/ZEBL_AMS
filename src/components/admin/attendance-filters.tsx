"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AttendanceFilters({
  defaultSearch,
  defaultDate,
}: {
  defaultSearch?: string;
  defaultDate?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch ?? "");
  const [date, setDate] = useState(defaultDate ?? "");

  function apply() {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (date) p.set("date", date);
    router.push(`/admin/attendance?${p.toString()}`);
  }

  function clear() {
    setSearch("");
    setDate("");
    router.push("/admin/attendance");
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[12rem] flex-1 space-y-1.5">
        <Label htmlFor="search">Employee</Label>
        <Input
          id="search"
          placeholder="Name or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex gap-2 pb-0.5">
        <Button onClick={apply}>Apply</Button>
        <Button variant="outline" onClick={clear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
