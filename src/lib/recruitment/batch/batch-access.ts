import { prisma } from "@/lib/prisma";
import { PermissionError } from "@/lib/permissions";
import { batchBucket } from "@/lib/recruitment/batch/batch-progress";

/**
 * What a manager may do with a batch HR shared with them: see its candidates,
 * rate the Manager Round, and decide Hire / Reject / Hold for people who are
 * in the Manager Round. Kept free of service imports so permission checks can
 * use it without import cycles.
 */

const liveShare = (userId: string) => ({ userId, batch: { deletedAt: null } });

/** The applications in batches shared with this user (open or closed). */
export async function sharedBatchApplications(userId: string) {
  const rows = await prisma.hiringBatchManager.findMany({
    where: liveShare(userId),
    select: {
      batch: {
        select: {
          members: {
            where: { application: { deletedAt: null } },
            select: { application: { select: { id: true, candidateId: true, jobOpeningId: true } } },
          },
        },
      },
    },
  });
  return rows.flatMap((r) => r.batch.members.map((m) => m.application));
}

export async function hasSharedBatches(userId: string): Promise<boolean> {
  return (await prisma.hiringBatchManager.count({ where: liveShare(userId) })) > 0;
}

export async function isBatchManagerOf(userId: string, batchId: string): Promise<boolean> {
  const row = await prisma.hiringBatchManager.findFirst({
    where: { userId, batchId, batch: { deletedAt: null } },
    select: { id: true },
  });
  return row != null;
}

/** The application is in an open batch shared with this user. */
async function inOpenSharedBatch(userId: string, applicationId: string): Promise<boolean> {
  const row = await prisma.hiringBatchMember.findFirst({
    where: {
      applicationId,
      batch: { deletedAt: null, status: "open", managers: { some: { userId } } },
    },
    select: { id: true },
  });
  return row != null;
}

/** Stages a manager may move someone to: Hire, Hold, or back to the Manager Round (Undo). */
const MANAGER_TARGETS = new Set(["decision", "on_hold", "manager_round"]);

/**
 * A manager's step on a shared batch: the person must be with the manager
 * (Manager Round, or just moved to Hire / Hold by them), not yet offered.
 */
export async function assertManagerCanDecide(
  userId: string,
  applicationId: string,
  target: string | "reject" | "reopen" | "hire_decision" | "rate"
): Promise<void> {
  const deny = (message: string): never => {
    throw new PermissionError(message);
  };
  if (!(await inOpenSharedBatch(userId, applicationId))) {
    deny("This candidate isn't in a batch shared with you.");
  }
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { currentStage: true, status: true },
  });
  if (!app) deny("Application not found.");
  const bucket = batchBucket(app!.currentStage, app!.status);

  if (target === "hire_decision") {
    // The decision record Hire saves, right after moving them to Hire.
    if (!(bucket === "hire" && app!.currentStage === "decision")) deny("Hire them first.");
    return;
  }
  if (target === "reopen") {
    if (bucket !== "rejected") deny("Only a rejected candidate can be reopened.");
    return;
  }
  if (target === "reject" || target === "decision" || target === "on_hold" || target === "rate") {
    if (bucket !== "manager_round") deny("Managers decide for people in the Manager Round.");
    return;
  }
  if (MANAGER_TARGETS.has(target)) {
    // Undo: back to the Manager Round from Hire (before any offer) or Hold.
    const ok = (bucket === "hire" && app!.currentStage === "decision") || bucket === "on_hold";
    if (!ok) deny("This candidate can't be moved back now.");
    return;
  }
  deny("Managers can only Hire, Reject or Hold.");
}
