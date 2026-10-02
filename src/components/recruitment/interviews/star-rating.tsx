"use client";

import { useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { starLabel, starTone, type StarTone } from "@/lib/recruitment/interview/scorecard";

const FILL: Record<StarTone, string> = {
  red: "fill-red-500 text-red-500",
  amber: "fill-amber-400 text-amber-400",
  lime: "fill-lime-500 text-lime-500",
  green: "fill-emerald-600 text-emerald-600",
};

const TEXT: Record<StarTone, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  lime: "text-lime-700 dark:text-lime-400",
  green: "text-emerald-700 dark:text-emerald-400",
};

const EMPTY = "fill-transparent text-muted-foreground/40";

/**
 * Five tappable stars coloured by score. Hover previews the colour and word;
 * clicking the selected star again clears it; keys 1-5 / arrows / 0 work when
 * the row has focus.
 */
export function StarRatingInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const tone = shown ? starTone(shown) : null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (/^[1-5]$/.test(e.key)) {
      onChange(Number(e.key));
      e.preventDefault();
    } else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
      onChange(undefined);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      onChange(Math.min(5, (value ?? 0) + 1));
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      const next = (value ?? 1) - 1;
      onChange(next >= 1 ? next : undefined);
      e.preventDefault();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label} rating`}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${value} of 5, ${starLabel(value)}` : "Not rated"}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        className="flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={`${n} star${n > 1 ? "s" : ""}: ${starLabel(n)}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(value === n ? undefined : n)}
            className="p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100 sm:p-1"
          >
            <Star className={cn("h-7 w-7 sm:h-6 sm:w-6", n <= shown && tone ? FILL[tone] : EMPTY)} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <span className={cn("w-24 text-xs font-semibold", tone ? TEXT[tone] : "text-muted-foreground")}>
        {shown ? starLabel(shown) : "Not rated"}
      </span>
    </div>
  );
}

/** Read-only stars for summaries; averages fill to the nearest whole star. */
export function StarRatingDisplay({
  value,
  size = "sm",
  showNumber = false,
}: {
  value: number | null | undefined;
  size?: "xs" | "sm";
  showNumber?: boolean;
}) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const filled = Math.round(value);
  const tone = starTone(value);
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${Math.round(value * 10) / 10} of 5, ${starLabel(value)}`}
      aria-label={`${Math.round(value * 10) / 10} of 5 stars, ${starLabel(value)}`}
    >
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn(cls, n <= filled ? FILL[tone] : EMPTY)} strokeWidth={1.5} />
        ))}
      </span>
      {showNumber ? (
        <span className={cn("text-[11px] font-bold tabular-nums", TEXT[tone])}>
          {Math.round(value * 10) / 10}
        </span>
      ) : null}
    </span>
  );
}
