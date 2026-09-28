import type { HelpAccent, HelpBlock, HelpCalloutKind } from "@/lib/help/types";
import { cn } from "@/lib/utils";

const ACCENT_TEXT: Record<HelpAccent, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
  teal: "text-teal-600 dark:text-teal-400",
};

const ACCENT_BADGE: Record<HelpAccent, string> = {
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  teal: "bg-teal-600",
};

const CALLOUT_STYLES: Record<HelpCalloutKind, string> = {
  note: "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
  tip: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning: "border-warning bg-warning-muted text-amber-900 dark:text-amber-100",
  danger: "border-danger bg-danger-muted text-red-900 dark:text-red-100",
  exclusive: "border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-100",
};

function renderInlineCode(text: string) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      >
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function HelpBlockView({ block, accent }: { block: HelpBlock; accent: HelpAccent }) {
  switch (block.type) {
    case "sectionHeading":
      return (
        <h3 className={cn("mt-6 mb-2 text-base font-bold", ACCENT_TEXT[accent])}>{block.text}</h3>
      );
    case "paragraph":
      return <p className="mb-3 text-sm leading-relaxed text-foreground/90">{renderInlineCode(block.text)}</p>;
    case "steps":
      return (
        <ol className="mb-4 space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white",
                  ACCENT_BADGE[accent]
                )}
              >
                {i + 1}
              </span>
              <span>{renderInlineCode(item)}</span>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className={cn("mb-4 rounded-lg border-l-4 p-4", CALLOUT_STYLES[block.kind])}>
          <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider">{block.label}</p>
          <p className="text-sm leading-relaxed">{renderInlineCode(block.text)}</p>
        </div>
      );
    case "table":
      return (
        <div className="mb-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/60">
                {block.columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                    style={{ width: `${block.widths[i]}%` }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={cn("border-t border-border", ri % 2 === 1 && "bg-muted/30")}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2 align-top text-foreground/90",
                        ci === 0 && "font-mono text-xs text-foreground"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cards":
      return (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <p className="mb-1 text-sm font-bold text-foreground">{item.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      );
  }
}
