"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AppErrorLogRow, AppErrorLogSearch } from "@/lib/observability/error-log-queries";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function where(row: AppErrorLogRow): string {
  return [row.method, row.path].filter(Boolean).join(" ") || "—";
}

function detailsText(row: AppErrorLogRow): string {
  return [
    `Ref: ${row.ref}`,
    `When: ${formatWhen(row.createdAt)} IST`,
    `Event: ${row.event} (${row.source}${row.routeType ? `, ${row.routeType}` : ""})`,
    `Where: ${where(row)}`,
    `User: ${row.userEmail ?? "—"}`,
    `Error: ${row.errorName ? `${row.errorName}: ` : ""}${row.message}`,
    row.context ? `Context: ${JSON.stringify(row.context, null, 2)}` : null,
    row.stack ? `Stack:\n${row.stack}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy the error details:", text);
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy details"}
    </Button>
  );
}

function ErrorRow({ row, defaultOpen }: { row: AppErrorLogRow; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <ChevronRight
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{row.message}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{formatWhen(row.createdAt)}</span>
            <span className="font-mono">{row.ref}</span>
            <span className="truncate">{where(row)}</span>
            {row.userEmail ? <span>{row.userEmail}</span> : null}
          </p>
        </div>
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4 pl-11">
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Event</dt>
            <dd className="font-mono">{row.event}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd>
              {row.source === "request" ? "Uncaught error" : "Logged error"}
              {row.routeType ? ` · ${row.routeType}` : ""}
            </dd>
            <dt className="text-muted-foreground">Error</dt>
            <dd className="break-words">
              {row.errorName ? `${row.errorName}: ` : ""}
              {row.message}
            </dd>
          </dl>
          {row.context && Object.keys(row.context as object).length > 0 ? (
            <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
              {JSON.stringify(row.context, null, 2)}
            </pre>
          ) : null}
          {row.stack ? (
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
              {row.stack}
            </pre>
          ) : null}
          <CopyButton text={detailsText(row)} />
        </div>
      ) : null}
    </li>
  );
}

export function AdminErrorLogView({
  result,
  page,
  q,
}: {
  result: AppErrorLogSearch;
  page: number;
  q?: string;
}) {
  if (!result.ok) {
    return (
      <SectionCard title="Error log isn't set up yet">
        <p className="text-sm text-muted-foreground">
          The <code className="font-mono">app_error_logs</code> table doesn&apos;t exist in this
          database. Run the migration SQL for it, then errors will start appearing here.
        </p>
      </SectionCard>
    );
  }

  const { rows, total, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) =>
    `/admin/operations/errors?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <SectionCard title="Find an error" description={`${total} ${total === 1 ? "entry" : "entries"}`}>
        <form method="get" className="flex flex-wrap gap-3">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Paste a Ref (e.g. action-error-c1c8a7fa-2b9), message, page or email…"
            className="min-w-0 flex-1"
            autoFocus={!q}
          />
          <Button type="submit">Search</Button>
          {q ? (
            <Button asChild variant="ghost">
              <Link href="/admin/operations/errors">Clear</Link>
            </Button>
          ) : null}
        </form>
      </SectionCard>

      <SectionCard title="Errors" description="Newest first. Kept for 90 days." noPadding>
        {rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={q ? "No errors match" : "No errors recorded"}
            description={
              q
                ? "Errors are recorded from when this feature was deployed. Try the action again, then search the new Ref."
                : "Server errors will appear here as they happen."
            }
            className="py-10"
          />
        ) : (
          <ul>
            {rows.map((row) => (
              <ErrorRow key={row.id} row={row} defaultOpen={Boolean(q) && rows.length === 1} />
            ))}
          </ul>
        )}
      </SectionCard>

      {totalPages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="text-primary hover:underline">
              Previous
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href(page + 1)} className="text-primary hover:underline">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
