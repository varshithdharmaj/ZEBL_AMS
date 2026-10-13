"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HiringDecisionOutcome, RecruitmentPipelineStage } from "@/generated/prisma/enums";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { isOfferEligibleDecisionOutcome } from "@/lib/recruitment/decision/eligibility";
import type { ActionState } from "@/actions/types";
import { getSessionOrThrow, requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { submitHiringDecisionSchema } from "@/lib/validation/schemas/recruitment";
import { createHiringDecisionService } from "@/lib/recruitment/services/hiring-decision-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentDecisionActionState = ActionState & {
  decisionId?: string;
  version?: number;
};

function revalidateDecisionViews(applicationId: string) {
  revalidatePath(`/admin/recruitment/applications/${applicationId}`);
  revalidatePath("/admin/recruitment/pipeline");
  revalidatePath("/admin/recruitment/applications");
  revalidatePath("/admin/recruitment");
  revalidatePath("/admin/recruitment/offers");
  revalidatePath("/admin/recruitment/offers/new");
}

export async function submitHiringDecisionAction(
  _prev: RecruitmentDecisionActionState,
  input: unknown
): Promise<RecruitmentDecisionActionState> {
  try {
    const parsed = safeParseWithSchema(submitHiringDecisionSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createHiringDecisionService();
    const decision = await service.submit(session, parsed.data);

    revalidateDecisionViews(parsed.data.applicationId);

    return {
      success:
        decision.version > 1
          ? `Hiring decision revised (version ${decision.version}).`
          : "Hiring decision submitted.",
      decisionId: decision.id,
      version: decision.version,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

/**
 * "Hire" in the candidate panel: moves the candidate to Hire and, unless a
 * hire decision is already saved, saves one so Make offer works next.
 */
export async function markHireAction(input: unknown): Promise<ActionState> {
  try {
    const parsed = safeParseWithSchema(z.object({ id: z.string().trim().min(1) }), input);
    if (!parsed.ok) return { error: parsed.error };
    // HR, or the manager of a shared batch (checked by the services below).
    const session = await getSessionOrThrow();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const applicationId = parsed.data.id;

    await createApplicationService().moveToStage(session, {
      id: applicationId,
      stage: RecruitmentPipelineStage.decision,
    });

    const decisions = createHiringDecisionService();
    const current = await decisions.getCurrent(session, applicationId);
    if (!current || !isOfferEligibleDecisionOutcome(current.outcome)) {
      await decisions.submit(session, {
        applicationId,
        outcome: HiringDecisionOutcome.hire,
        rationale: "Marked Hire after the interview rounds.",
        strengths: "See the interview scorecards and comments.",
      });
    }

    revalidateDecisionViews(applicationId);
    return { success: "Marked Hire." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
