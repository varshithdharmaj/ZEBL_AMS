/**
 * Fixed reason lists for closing an application. "We rejected them" and
 * "they withdrew" are kept as separate lists so reports can tell them apart.
 *
 * The code is stored in `rejection_reason_code` / `withdrawal_reason_code`;
 * the free-text note stays in `rejected_reason` / `withdrawn_reason`.
 * Client-safe (no server imports) so dialogs, cards and services share it.
 */

export const REJECTION_REASONS = [
  { code: "skills_mismatch", label: "Skills / experience mismatch" },
  { code: "failed_assessment", label: "Failed assessment" },
  { code: "failed_interview", label: "Failed interview round" },
  { code: "salary_too_high", label: "Salary expectations too high" },
  { code: "notice_or_location", label: "Notice period / location" },
  { code: "no_show", label: "No-show / unresponsive" },
  { code: "position_filled", label: "Position filled" },
  { code: "duplicate", label: "Duplicate application" },
  { code: "other", label: "Other" },
] as const;

export const WITHDRAWAL_REASONS = [
  { code: "accepted_other_offer", label: "Accepted another offer" },
  { code: "not_interested", label: "Not interested" },
  { code: "compensation", label: "Compensation" },
  { code: "relocation", label: "Relocation" },
  { code: "stopped_responding", label: "Stopped responding" },
  { code: "other", label: "Other" },
] as const;

export type CloseKind = "reject" | "withdraw";
export type RejectionReasonCode = (typeof REJECTION_REASONS)[number]["code"];
export type WithdrawalReasonCode = (typeof WITHDRAWAL_REASONS)[number]["code"];

export const REJECTION_REASON_CODES = REJECTION_REASONS.map((r) => r.code) as [
  RejectionReasonCode,
  ...RejectionReasonCode[],
];
export const WITHDRAWAL_REASON_CODES = WITHDRAWAL_REASONS.map((r) => r.code) as [
  WithdrawalReasonCode,
  ...WithdrawalReasonCode[],
];

export function closeReasons(kind: CloseKind) {
  return kind === "reject" ? REJECTION_REASONS : WITHDRAWAL_REASONS;
}

export function closeReasonLabel(kind: CloseKind, code: string | null | undefined): string | null {
  if (!code) return null;
  return closeReasons(kind).find((r) => r.code === code)?.label ?? null;
}

/**
 * One-line summary of why an application was closed, e.g.
 * "Failed interview round — weak on SQL". Falls back to the free-text note
 * for applications closed before reason codes existed.
 */
export function describeCloseReason(
  kind: CloseKind,
  code: string | null | undefined,
  note: string | null | undefined
): string | null {
  const label = closeReasonLabel(kind, code);
  const trimmed = note?.trim() || null;
  if (label && trimmed) return `${label} — ${trimmed}`;
  return label ?? trimmed;
}
