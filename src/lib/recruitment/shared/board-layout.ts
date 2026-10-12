import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { CUSTOM_STAGE_SLOTS, PIPELINE_BOARD_COLUMN_FILTERS } from "./pipeline-stage-groups";

/**
 * Column order for one job's Pipeline board: the paper plan's five groups,
 * plus any column HR added with "Add stage", where they put it. Pure — safe
 * for client imports.
 */

export type JobStageRow = {
  id: string;
  stage: RecruitmentPipelineStage;
  label?: string | null;
  sortOrder: number;
  isEnabled?: boolean;
  isArchived?: boolean;
};

export type BoardLayoutEntry =
  | {
      kind: "group";
      groupId: string;
      /** The job's first and last stage rows in this group, for "Add stage" before / after it. */
      firstRowId: string | null;
      lastRowId: string | null;
    }
  | { kind: "custom"; rowId: string; stage: RecruitmentPipelineStage; label: string };

const CUSTOM = new Set<string>(CUSTOM_STAGE_SLOTS);

function groupOf(stage: RecruitmentPipelineStage): string | null {
  if (CUSTOM.has(stage)) return null;
  return PIPELINE_BOARD_COLUMN_FILTERS.find((g) => (g.stages as readonly string[]).includes(stage))?.id ?? null;
}

/**
 * Walks the job's stages in order. A group appears where its first stage
 * sits; a custom column appears where HR placed it. Groups the job has no
 * stage for (Reject, Hold) go at the end in the usual order.
 */
export function buildBoardLayout(rows: readonly JobStageRow[]): BoardLayoutEntry[] {
  const usable = rows
    .filter((r) => r.isEnabled !== false && !r.isArchived)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const layout: BoardLayoutEntry[] = [];
  const groups = new Map<string, Extract<BoardLayoutEntry, { kind: "group" }>>();

  for (const row of usable) {
    if (CUSTOM.has(row.stage)) {
      layout.push({ kind: "custom", rowId: row.id, stage: row.stage, label: row.label?.trim() || "New stage" });
      continue;
    }
    const groupId = groupOf(row.stage);
    if (!groupId) continue;
    const existing = groups.get(groupId);
    if (existing) {
      existing.lastRowId = row.id;
    } else {
      const entry = { kind: "group" as const, groupId, firstRowId: row.id, lastRowId: row.id };
      groups.set(groupId, entry);
      layout.push(entry);
    }
  }

  for (const g of PIPELINE_BOARD_COLUMN_FILTERS) {
    if (!groups.has(g.id)) layout.push({ kind: "group", groupId: g.id, firstRowId: null, lastRowId: null });
  }
  return layout;
}

/** The job's own (Add stage) columns shown on the board, so the groups can leave them out. */
export function customStagesInLayout(layout: readonly BoardLayoutEntry[]): Set<string> {
  return new Set(layout.flatMap((e) => (e.kind === "custom" ? [e.stage] : [])));
}
