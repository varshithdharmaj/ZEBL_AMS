"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import {
  addApplicationsToBatch,
  createBatch,
  listOpenBatchOptions,
  removeMembers,
  searchCandidatesForBatch,
  renameBatch,
  setBatchInterviewDate,
  setBatchStatus,
  updateMemberRemarks,
  type AddToBatchResult,
  type BatchCandidateOption,
  type OpenBatchOption,
} from "@/lib/recruitment/batch/batch-service";
import { parseInterviewDate } from "@/lib/recruitment/batch/batch-membership";

const BATCHES_PATH = "/admin/recruitment/batches";

function revalidateBatch(batchId?: string) {
  revalidatePath(BATCHES_PATH);
  if (batchId) revalidatePath(`${BATCHES_PATH}/${batchId}`);
  revalidatePath("/admin/recruitment");
}

const id = z.string().trim().min(1);
const batchName = z.string().trim().max(120, "Keep the name under 120 characters.").nullable().optional();
const interviewDate = z
  .string({ error: "Pick the interview date." })
  .transform((value, ctx) => {
    const date = parseInterviewDate(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Pick the interview date." });
      return z.NEVER;
    }
    return date;
  });
const newBatchInput = z.object({ name: batchName, interviewDate });

export type CreateBatchState = ActionState & { batchId?: string; code?: string };

export async function createBatchAction(input: unknown): Promise<CreateBatchState> {
  try {
    const parsed = safeParseWithSchema(newBatchInput, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const created = await createBatch(session, {
      name: parsed.data.name ?? null,
      interviewDate: parsed.data.interviewDate,
    });
    revalidateBatch(created.id);
    return { success: `Batch ${created.code} created.`, batchId: created.id, code: created.code };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function renameBatchAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(z.object({ batchId: id, name: batchName }), input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    await renameBatch(session, parsed.data.batchId, parsed.data.name ?? null);
    revalidateBatch(parsed.data.batchId);
    return { success: "Name saved." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function setBatchInterviewDateAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(z.object({ batchId: id, interviewDate }), input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    await setBatchInterviewDate(session, parsed.data.batchId, parsed.data.interviewDate);
    revalidateBatch(parsed.data.batchId);
    return { success: "Interview date saved." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function setBatchStatusAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(
      z.object({ batchId: id, status: z.nativeEnum(HiringBatchStatus) }),
      input
    );
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    await setBatchStatus(session, parsed.data.batchId, parsed.data.status);
    revalidateBatch(parsed.data.batchId);
    return { success: parsed.data.status === HiringBatchStatus.closed ? "Batch closed." : "Batch reopened." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateBatchRemarksAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(
      z.object({
        memberId: id,
        remarks: z.string().max(2000, "Keep remarks under 2000 characters.").nullable(),
      }),
      input
    );
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const batchId = await updateMemberRemarks(session, parsed.data.memberId, parsed.data.remarks);
    revalidatePath(`${BATCHES_PATH}/${batchId}`);
    return { success: "Saved." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function removeBatchMembersAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(
      z.object({ batchId: id, memberIds: z.array(id).min(1, "Select at least one candidate.").max(500) }),
      input
    );
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const count = await removeMembers(session, parsed.data.batchId, parsed.data.memberIds);
    revalidateBatch(parsed.data.batchId);
    return { success: `Removed ${count} from the batch.` };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listOpenBatchesAction(): Promise<ActionState & { batches?: OpenBatchOption[] }> {
  try {
    const session = await requireRecruitmentAdminSession();
    return { batches: await listOpenBatchOptions(session) };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

const addToBatchInput = z.object({
  applicationIds: z.array(id).min(1, "Select at least one candidate.").max(500),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), batchId: id }),
    z.object({ kind: z.literal("new"), batch: newBatchInput }),
  ]),
});

export type AddToBatchState = ActionState & {
  batchId?: string;
  code?: string;
  result?: AddToBatchResult;
};

export async function addToBatchAction(input: unknown): Promise<AddToBatchState> {
  try {
    const parsed = safeParseWithSchema(addToBatchInput, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const { target, applicationIds } = parsed.data;
    const batch =
      target.kind === "existing"
        ? { id: target.batchId, code: undefined }
        : await createBatch(session, { name: target.batch.name ?? null, interviewDate: target.batch.interviewDate });
    const result = await addApplicationsToBatch(session, batch.id, applicationIds);
    revalidateBatch(batch.id);
    return { batchId: batch.id, code: batch.code, result };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function searchCandidatesForBatchAction(
  input: unknown
): Promise<ActionState & { options?: BatchCandidateOption[] }> {
  try {
    const parsed = safeParseWithSchema(z.object({ batchId: id, query: z.string().max(100) }), input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    return { options: await searchCandidatesForBatch(session, parsed.data.batchId, parsed.data.query) };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
