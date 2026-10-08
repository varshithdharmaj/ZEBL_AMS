"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  companyIsBlank,
  companyMonths,
  companyProblem,
  formatDuration,
  formatYearMonth,
  MONTH_NAMES,
  newCompany,
  newRole,
  roleMonths,
  roleProblem,
  totalExperienceMonths,
  type CompanyEntry,
  type RoleEntry,
  type YearMonth,
} from "@/lib/recruitment/public-apply/experience-entries";

const SELECT_CLASS =
  "flex h-9.5 w-full rounded-lg border border-input bg-card px-2.5 text-sm shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

const FIRST_YEAR = 1960;

/** Experience entered company by company, with each role (and its dates) under its company. */
export function ExperienceEditor({
  id,
  companies,
  onChange,
  showProblems,
  error,
}: {
  id: string;
  companies: CompanyEntry[];
  onChange: (companies: CompanyEntry[]) => void;
  /** Inline per-company/role messages — switched on after a failed preview attempt. */
  showProblems: boolean;
  error?: string;
}) {
  const now = new Date();
  const total = totalExperienceMonths(companies, now);

  function updateCompany(companyId: string, patch: Partial<CompanyEntry>) {
    onChange(companies.map((c) => (c.id === companyId ? { ...c, ...patch } : c)));
  }
  function updateRole(companyId: string, roleId: string, patch: Partial<RoleEntry>) {
    onChange(
      companies.map((c) =>
        c.id === companyId ? { ...c, roles: c.roles.map((r) => (r.id === roleId ? { ...r, ...patch } : r)) } : c
      )
    );
  }

  return (
    <div id={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Experience</h3>
        {total > 0 ? (
          <span className="text-xs text-muted-foreground">
            Total: <span className="font-medium text-foreground">{formatDuration(total)}</span>
          </span>
        ) : null}
      </div>

      {companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No experience added. Freshers can leave this empty.</p>
      ) : null}

      {companies.map((company, companyIndex) => {
        const months = companyMonths(company, now);
        const problem = showProblems && !companyIsBlank(company) ? companyProblem(company) : null;
        return (
          <div key={company.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`${company.id}-name`}>Company {companies.length > 1 ? companyIndex + 1 : ""}</Label>
                <Input
                  id={`${company.id}-name`}
                  value={company.company}
                  onChange={(e) => updateCompany(company.id, { company: e.target.value })}
                  placeholder="e.g. Example Technologies"
                  aria-invalid={Boolean(problem)}
                  className={cn(problem && "border-danger")}
                />
                {months > 0 ? (
                  <p className="text-xs text-muted-foreground">{formatDuration(months)} at this company</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6"
                aria-label={`Remove ${company.company.trim() || "this company"}`}
                onClick={() => onChange(companies.filter((c) => c.id !== company.id))}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {problem ? <p className="text-xs text-danger">{problem}</p> : null}

            {company.roles.map((role, roleIndex) => (
              <RoleCard
                key={role.id}
                role={role}
                label={company.roles.length > 1 ? `Role ${roleIndex + 1}` : "Role"}
                now={now}
                showProblems={showProblems && !companyIsBlank(company)}
                onChange={(patch) => updateRole(company.id, role.id, patch)}
                onRemove={
                  company.roles.length > 1
                    ? () => updateCompany(company.id, { roles: company.roles.filter((r) => r.id !== role.id) })
                    : undefined
                }
              />
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => updateCompany(company.id, { roles: [...company.roles, newRole()] })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add another role at {company.company.trim() || "this company"}
            </Button>
          </div>
        );
      })}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...companies, newCompany()])}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add company
      </Button>
    </div>
  );
}

function RoleCard({
  role,
  label,
  now,
  showProblems,
  onChange,
  onRemove,
}: {
  role: RoleEntry;
  label: string;
  now: Date;
  showProblems: boolean;
  onChange: (patch: Partial<RoleEntry>) => void;
  onRemove?: () => void;
}) {
  const problem = showProblems ? roleProblem(role, now) : null;
  const months = roleMonths(role, now);
  return (
    <div className={cn("flex flex-col gap-3 rounded-md border-l-2 bg-muted/30 p-3", problem ? "border-danger" : "border-primary/40")}>
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${role.id}-title`}>{label}</Label>
          <Input
            id={`${role.id}-title`}
            value={role.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. HR Executive"
          />
        </div>
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MonthYearPicker label="From" value={role.start} now={now} onChange={(start) => onChange({ start })} />
        {role.isCurrent ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <span className="flex h-9.5 items-center text-sm text-foreground">Present</span>
          </div>
        ) : (
          <MonthYearPicker label="To" value={role.end} now={now} onChange={(end) => onChange({ end })} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox checked={role.isCurrent} onCheckedChange={(isCurrent) => onChange({ isCurrent })} />
          I currently work in this role
        </label>
        {months > 0 ? (
          <span className="text-xs text-muted-foreground">
            {formatYearMonth(role.start)} – {role.isCurrent ? "Present" : formatYearMonth(role.end)} ·{" "}
            <span className="font-medium text-foreground">{formatDuration(months)}</span>
          </span>
        ) : null}
      </div>
      {problem ? <p className="text-xs text-danger">{problem}</p> : null}
    </div>
  );
}

function MonthYearPicker({
  label,
  value,
  now,
  onChange,
}: {
  label: string;
  value: YearMonth;
  now: Date;
  onChange: (value: YearMonth) => void;
}) {
  const years: string[] = [];
  for (let y = now.getFullYear(); y >= FIRST_YEAR; y--) years.push(String(y));
  // Keep a parsed year outside the list selectable rather than silently blanking it.
  if (value.year && !years.includes(value.year)) years.push(value.year);

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label={`${label} month`}
          className={SELECT_CLASS}
          value={value.month}
          onChange={(e) => onChange({ ...value, month: e.target.value })}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, "0")}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} year`}
          className={SELECT_CLASS}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: e.target.value })}
        >
          <option value="">Year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Read-only company → roles list for the preview step. */
export function ExperienceSummary({ companies }: { companies: CompanyEntry[] }) {
  const now = new Date();
  const total = totalExperienceMonths(companies, now);
  return (
    <div className="flex flex-col gap-3">
      {total > 0 ? <p className="text-muted-foreground">Total: {formatDuration(total)}</p> : null}
      <ul className="flex flex-col gap-3">
        {companies.map((company) => (
          <li key={company.id}>
            <p className="font-medium">
              {company.company}
              <span className="font-normal text-muted-foreground"> · {formatDuration(companyMonths(company, now))}</span>
            </p>
            <ul className="mt-1 flex flex-col gap-1.5 border-l-2 border-border pl-3">
              {company.roles.map((role) => (
                <li key={role.id}>
                  <p>{role.title}</p>
                  <p className="text-muted-foreground">
                    {formatYearMonth(role.start)} – {role.isCurrent ? "Present" : formatYearMonth(role.end)} ·{" "}
                    {formatDuration(roleMonths(role, now))}
                  </p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
