import type { ActionState } from "@/lib/recruitment/types/action";
import type { ActionResult } from "@/lib/recruitment/types/action";
import {
  isRecruitmentDomainError,
  RecruitmentDomainError,
} from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";
import { logger } from "@/lib/observability/logger";
import { createCorrelationId } from "@/lib/observability/correlation";

export type MappedActionState = ActionState & {
  duplicateCandidateId?: string;
};

export function okResult<T>(data: T, success?: string): ActionResult<T> {
  return { ok: true, data, state: success ? { success } : undefined };
}

export function failResult<T = never>(error: string): ActionResult<T> {
  return { ok: false, state: { error } };
}

export function toActionState(result: ActionResult<unknown>): ActionState {
  if (result.ok) return result.state ?? { success: "OK" };
  return result.state;
}

function readDuplicateCandidateId(
  details: Record<string, unknown> | undefined
): string | undefined {
  const value = details?.duplicateCandidateId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function mapUnknownToActionState(error: unknown): MappedActionState {
  if (isRecruitmentDomainError(error)) {
    const duplicateCandidateId = readDuplicateCandidateId(error.details);
    if (duplicateCandidateId) {
      return { error: error.message, duplicateCandidateId };
    }
    return { error: error.message };
  }
  if (error instanceof PermissionError) {
    return { error: error.message };
  }
  // Avoid leaking Prisma/internal stack details to clients. Log the real
  // cause server-side under a correlation id, and surface just that id to
  // the client so it can be matched to the log entry without exposing
  // internal error content.
  const correlationId = createCorrelationId("action-error");
  logger.error("recruitment.action.unexpected_error", {
    correlationId,
    entityType: "action",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return { error: `Server-side error. Ref: ${correlationId}` };
}

export function assertNever(value: never): never {
  throw new RecruitmentDomainError("REC_INTERNAL", `Unhandled value: ${String(value)}`);
}
