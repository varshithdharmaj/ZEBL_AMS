/** Subtle, neutral card accents — color reserved for status badges only */
export type AccentColor = "primary" | "sky" | "emerald" | "violet" | "amber" | "rose" | "teal";

export const accentStyles: Record<
  AccentColor,
  { icon: string; value: string; border: string; header: string }
> = {
  primary: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  sky: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  emerald: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  violet: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  amber: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  rose: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
  teal: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    border: "border-l-border",
    header: "bg-muted/40",
  },
};
