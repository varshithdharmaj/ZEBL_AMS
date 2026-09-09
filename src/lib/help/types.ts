export type HelpAccent = "blue" | "purple" | "teal";

export type HelpCalloutKind = "note" | "tip" | "warning" | "danger" | "exclusive";

export type HelpBlock =
  | { type: "sectionHeading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "callout"; kind: HelpCalloutKind; label: string; text: string }
  | { type: "table"; columns: string[]; widths: number[]; rows: string[][] }
  | { type: "cards"; items: { title: string; text: string }[] };

export type HelpChapter = {
  number: string;
  tag?: string;
  title: string;
  intro: string;
  blocks: HelpBlock[];
};

export type HelpRole = "hr" | "super_admin" | "manager" | "employee";

export type HelpGuideMeta = {
  role: HelpRole;
  roleLabel: string;
  accent: HelpAccent;
  coverDescription: string;
  edition: string;
};
