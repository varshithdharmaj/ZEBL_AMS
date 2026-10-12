import { RecruitmentPipelineStage, StageCategory } from "@/generated/prisma/enums";

/**
 * Spare enum values that only exist so "Add Stage" always has a free slot —
 * every job is seeded with all the named stages, so without these a new
 * column had nothing left to claim. They have no meaning of their own: the
 * column's name/category come from its JobOpeningStage row. Where the code
 * only has the enum value (board filters, funnel rollups), they behave like
 * interview rounds, same as the named round slots custom columns used to
 * claim.
 */
export const CUSTOM_STAGE_SLOTS = [
  RecruitmentPipelineStage.custom_1,
  RecruitmentPipelineStage.custom_2,
  RecruitmentPipelineStage.custom_3,
  RecruitmentPipelineStage.custom_4,
  RecruitmentPipelineStage.custom_5,
  RecruitmentPipelineStage.custom_6,
  RecruitmentPipelineStage.custom_7,
  RecruitmentPipelineStage.custom_8,
  RecruitmentPipelineStage.custom_9,
  RecruitmentPipelineStage.custom_10,
  RecruitmentPipelineStage.custom_11,
  RecruitmentPipelineStage.custom_12,
] as const;

type CustomStageSlot = (typeof CUSTOM_STAGE_SLOTS)[number];

function customSlotRecord<T>(value: (index: number) => T): Record<CustomStageSlot, T> {
  return Object.fromEntries(CUSTOM_STAGE_SLOTS.map((stage, i) => [stage, value(i)])) as Record<
    CustomStageSlot,
    T
  >;
}

/**
 * Single source of truth for which pipeline stages count as "screening" vs.
 * "interview" for recruiter-facing rollups (job list metrics, hiring funnel).
 */
export const SCREENING_STAGES: readonly RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
];

export const INTERVIEW_STAGES: readonly RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.reference_check,
  ...CUSTOM_STAGE_SLOTS,
];

/**
 * Sentinel value accepted by the pipeline list's `currentStage` filter to mean
 * "any interview stage" (see INTERVIEW_STAGES) instead of one exact stage.
 * Kept as a plain string sentinel — not a RecruitmentPipelineStage — so it
 * flows through the existing string-typed filter/query-param plumbing
 * unchanged; only the repository's where-builder special-cases it.
 */
export const INTERVIEWING_STAGE_FILTER = "interviewing";

/** Paper-plan board columns. Filter `currentStage` uses these ids, not every enum value. */
export const PIPELINE_BOARD_COLUMN_FILTERS = [
  {
    id: "hr_round",
    label: "HR Round",
    defaultStage: RecruitmentPipelineStage.hr_round,
    stages: [
      RecruitmentPipelineStage.resume_received,
      RecruitmentPipelineStage.screening,
      RecruitmentPipelineStage.assessment,
      RecruitmentPipelineStage.hr_round,
    ],
  },
  {
    id: "manager_round",
    label: "Manager Round",
    defaultStage: RecruitmentPipelineStage.manager_round,
    stages: [
      RecruitmentPipelineStage.technical_round,
      RecruitmentPipelineStage.team_lead_round,
      RecruitmentPipelineStage.manager_round,
      RecruitmentPipelineStage.client_round,
      RecruitmentPipelineStage.reference_check,
      ...CUSTOM_STAGE_SLOTS,
    ],
  },
  {
    id: "hire",
    label: "Hire",
    defaultStage: RecruitmentPipelineStage.decision,
    stages: [
      RecruitmentPipelineStage.decision,
      RecruitmentPipelineStage.offer,
      RecruitmentPipelineStage.hired,
    ],
  },
  {
    id: "reject",
    label: "Reject",
    defaultStage: RecruitmentPipelineStage.rejected,
    stages: [RecruitmentPipelineStage.rejected, RecruitmentPipelineStage.withdrawn],
  },
  {
    id: "hold",
    label: "Hold",
    defaultStage: RecruitmentPipelineStage.on_hold,
    stages: [RecruitmentPipelineStage.on_hold],
  },
] as const;

export type PipelineBoardColumnFilterId = (typeof PIPELINE_BOARD_COLUMN_FILTERS)[number]["id"];

export function pipelineBoardColumnFilter(
  value: string
): (typeof PIPELINE_BOARD_COLUMN_FILTERS)[number] | undefined {
  return PIPELINE_BOARD_COLUMN_FILTERS.find((column) => column.id === value);
}

/** Default display label for a stage when a job hasn't set a custom `JobOpeningStage.label`. */
export const PIPELINE_STAGE_LABELS: Record<RecruitmentPipelineStage, string> = {
  [RecruitmentPipelineStage.resume_received]: "Applied",
  [RecruitmentPipelineStage.screening]: "Screening",
  [RecruitmentPipelineStage.assessment]: "Assessment",
  [RecruitmentPipelineStage.hr_round]: "HR Round",
  [RecruitmentPipelineStage.technical_round]: "Technical Round",
  [RecruitmentPipelineStage.team_lead_round]: "Team Lead Round",
  [RecruitmentPipelineStage.manager_round]: "Manager Round",
  [RecruitmentPipelineStage.client_round]: "Client Round",
  [RecruitmentPipelineStage.reference_check]: "Reference Check",
  [RecruitmentPipelineStage.decision]: "Decision",
  [RecruitmentPipelineStage.offer]: "Offer",
  [RecruitmentPipelineStage.hired]: "Joined",
  [RecruitmentPipelineStage.rejected]: "Rejected",
  [RecruitmentPipelineStage.on_hold]: "On Hold",
  [RecruitmentPipelineStage.withdrawn]: "Withdrawn",
  ...customSlotRecord((i) => `Custom Stage ${i + 1}`),
};

/** Display name for a stage value when the job's own column name isn't at hand. */
export function pipelineStageLabel(stage: RecruitmentPipelineStage | string): string {
  return PIPELINE_STAGE_LABELS[stage as RecruitmentPipelineStage] ?? String(stage).replace(/_/g, " ");
}

/**
 * Single source of truth mapping every RecruitmentPipelineStage to its
 * StageCategory bucket — funnel counts, terminal-stage checks, and the
 * dynamic-stage backfill all key off this instead of comparing literal
 * enum values, so a job's relabeled/reordered stage still reports and
 * behaves correctly.
 *
 * `on_hold` and `withdrawn` have no dedicated bucket in the fixed
 * StageCategory enum (APPLIED/SCREENING/ASSESSMENT/INTERVIEW/DECISION/
 * OFFER/JOINED/REJECTED) — both are mapped to REJECTED as the closest
 * "did not progress" bucket. This is a deliberate judgment call, not a
 * schema gap: revisit if funnel reporting ever needs to distinguish
 * "on hold" from "rejected/withdrawn".
 */
export const PIPELINE_STAGE_CATEGORY: Record<RecruitmentPipelineStage, StageCategory> = {
  [RecruitmentPipelineStage.resume_received]: StageCategory.APPLIED,
  [RecruitmentPipelineStage.screening]: StageCategory.SCREENING,
  [RecruitmentPipelineStage.assessment]: StageCategory.ASSESSMENT,
  [RecruitmentPipelineStage.hr_round]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.technical_round]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.team_lead_round]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.manager_round]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.client_round]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.reference_check]: StageCategory.INTERVIEW,
  [RecruitmentPipelineStage.decision]: StageCategory.DECISION,
  [RecruitmentPipelineStage.offer]: StageCategory.OFFER,
  [RecruitmentPipelineStage.hired]: StageCategory.JOINED,
  [RecruitmentPipelineStage.rejected]: StageCategory.REJECTED,
  [RecruitmentPipelineStage.on_hold]: StageCategory.REJECTED,
  [RecruitmentPipelineStage.withdrawn]: StageCategory.REJECTED,
  ...customSlotRecord(() => StageCategory.INTERVIEW),
};

/**
 * Canonical full stage list (declaration order) used to seed a standard
 * default `JobOpeningStage` row per enum value for any JobOpening backfilled
 * with no explicit stages — see prisma/scripts/backfill-dynamic-pipeline-stages.ts.
 * Includes the terminal/system stages (hired/rejected/on_hold/withdrawn) so
 * every possible `Application.currentStage` value has an exact-match
 * JobOpeningStage row to backfill `currentStageId` against.
 */
export const DEFAULT_STAGE_SEED_ORDER: readonly RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.resume_received,
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.reference_check,
  RecruitmentPipelineStage.decision,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.hired,
  RecruitmentPipelineStage.rejected,
  RecruitmentPipelineStage.on_hold,
  RecruitmentPipelineStage.withdrawn,
];

/**
 * Stage enum values that are never offered as a slot for a recruiter-created
 * custom stage, and can never be renamed/reordered/archived through the
 * Phase 2 stage-management UI ("system stages" — the 🔒 stages in the
 * original Manage Pipeline design).
 *
 * Each one carries meaning elsewhere in the codebase beyond its
 * JobOpeningStage row, so letting a recruiter repurpose or remove it would
 * silently break other logic:
 *  - resume_received: application-service.createApplicationCore always
 *    resolves the initial stage as the job's lowest-sortOrder stage; Applied
 *    must stay first and present.
 *  - decision / offer: application-pipeline-drawer's decision/offer
 *    eligibility (canCreateOfferFromDecisionState) and the funnel's
 *    selected/offerSent counts key off these exact stage values.
 *  - hired: owned exclusively by Employee Conversion (moveToStage already
 *    refuses to accept it as a drag-and-drop target).
 */
export const SYSTEM_STAGE_VALUES: ReadonlySet<RecruitmentPipelineStage> = new Set([
  RecruitmentPipelineStage.resume_received,
  RecruitmentPipelineStage.decision,
  RecruitmentPipelineStage.offer,
  RecruitmentPipelineStage.hired,
]);

/**
 * Stage enum values a recruiter's "Add Stage" can claim for a new custom
 * stage — excludes SYSTEM_STAGE_VALUES (reserved, see above) and the
 * terminal status stages (rejected/on_hold/withdrawn), which are set only by
 * rejectApplication/withdrawApplication/reopenApplication, never by a
 * manual drag or an inserted custom column. The named values are only free
 * on jobs whose template left them out; CUSTOM_STAGE_SLOTS are what
 * normally get used.
 */
export const INSERTABLE_STAGE_POOL: readonly RecruitmentPipelineStage[] = [
  RecruitmentPipelineStage.screening,
  RecruitmentPipelineStage.assessment,
  RecruitmentPipelineStage.hr_round,
  RecruitmentPipelineStage.technical_round,
  RecruitmentPipelineStage.team_lead_round,
  RecruitmentPipelineStage.manager_round,
  RecruitmentPipelineStage.client_round,
  RecruitmentPipelineStage.reference_check,
  ...CUSTOM_STAGE_SLOTS,
];

/** Display labels for the "Add Stage" category dropdown. */
export const STAGE_CATEGORY_LABELS: Record<StageCategory, string> = {
  [StageCategory.APPLIED]: "Applied",
  [StageCategory.SCREENING]: "Screening",
  [StageCategory.ASSESSMENT]: "Assessment",
  [StageCategory.INTERVIEW]: "Interview",
  [StageCategory.DECISION]: "Decision",
  [StageCategory.OFFER]: "Offer",
  [StageCategory.JOINED]: "Joined",
  [StageCategory.REJECTED]: "Rejected",
};

/**
 * Categories offered when a recruiter adds a custom stage — excludes
 * APPLIED/DECISION/OFFER/JOINED, which are the categories of the system
 * stages (see SYSTEM_STAGE_VALUES) and would be misleading on a
 * recruiter-named stage since dashboards report those buckets as if they
 * were the canonical Applied/Decision/Offer/Joined step.
 */
export const CUSTOM_STAGE_CATEGORY_OPTIONS: readonly StageCategory[] = [
  StageCategory.SCREENING,
  StageCategory.ASSESSMENT,
  StageCategory.INTERVIEW,
  StageCategory.REJECTED,
];
