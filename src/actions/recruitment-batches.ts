"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { HiringBatchStatus } from "@/generated/prisma/enums";
import {
  createBatch,
  importPaste,
  previewPaste,
  removeMembers,
  renameBatch,
  setBatchStatus,
  updateMemberRemarks,
  type PasteImportResult,
  type PastePreview,
} from "@/lib/recruitment/batch/batch-service";

const BATCHES_PATH = "/admin/recruitment/batches";

function revalidateBatch(batchId?: string) {
  revalidatePath(BATCHES_PATH);
  if (batchId) revalidatePath(`${BATCHES_PATH}/${batchId}`);
  revalidatePath("/admin/recruitment");
}

const id = z.string().trim().min(1);
const batchName = z.string().trim().max(120, "Keep the name under 120 characters.").nullable().optional();

export type CreateBatchState = ActionState & { batchId?: string; code?: string };

export async function createBatchAction(input: unknown): Promise<CreateBatchState> {
  try {
    const parsed = safeParseWithSchema(z.object({ name: batchName }), input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const created = await createBatch(session, { name: parsed.data.name ?? null });
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

const pasteInput = z.object({
  batchId: id,
  jobOpeningId: z.string().trim().min(1, "Pick the role these candidates applied for."),
  text: z.string().max(500_000, "That paste is too large. Paste fewer rows at a time."),
});

export async function previewBatchPasteAction(
  input: unknown
): Promise<ActionState & { preview?: PastePreview }> {
  try {
    const parsed = safeParseWithSchema(pasteInput, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    return { preview: await previewPaste(session, parsed.data) };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function importBatchPasteAction(
  input: unknown
): Promise<ActionState & { result?: PasteImportResult }> {
  try {
    const parsed = safeParseWithSchema(pasteInput, input);
    if (!parsed.ok) return { error: parsed.error };
    const session = await requireRecruitmentAdminSession();
    const result = await importPaste(session, parsed.data);
    revalidateBatch(parsed.data.batchId);
    revalidatePath("/admin/recruitment/candidates");
    revalidatePath("/admin/recruitment/pipeline");
    return { result };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
