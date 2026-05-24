export type AccentColor = "primary" | "sky" | "emerald" | "violet" | "amber" | "rose" | "teal";

export const accentStyles: Record<
  AccentColor,
  { icon: string; value: string; border: string; header: string }
> = {
  primary: {
    icon: "bg-primary-muted text-primary",
    value: "text-primary",
    border: "border-l-primary",
    header: "bg-primary-muted/50",
  },
  sky: {
    icon: "bg-sky-muted text-sky",
    value: "text-sky",
    border: "border-l-sky",
    header: "bg-sky-muted/60",
  },
  emerald: {
    icon: "bg-emerald-muted text-emerald",
    value: "text-emerald",
    border: "border-l-emerald",
    header: "bg-emerald-muted/60",
  },
  violet: {
    icon: "bg-violet-muted text-violet",
    value: "text-violet",
    border: "border-l-violet",
    header: "bg-violet-muted/60",
  },
  amber: {
    icon: "bg-amber-muted text-amber",
    value: "text-amber",
    border: "border-l-amber",
    header: "bg-amber-muted/60",
  },
  rose: {
    icon: "bg-rose-muted text-rose",
    value: "text-rose",
    border: "border-l-rose",
    header: "bg-rose-muted/60",
  },
  teal: {
    icon: "bg-teal-muted text-teal",
    value: "text-teal",
    border: "border-l-teal",
    header: "bg-teal-muted/60",
  },
};
