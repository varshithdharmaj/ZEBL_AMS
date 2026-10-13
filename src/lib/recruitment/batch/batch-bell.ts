import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import type { NotificationCenterItem } from "@/lib/notifications/notification-center";
import { canAccessRecruitmentAdministration } from "@/lib/recruitment/permissions/recruitment-test-manager";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { PIPELINE_BOARD_COLUMN_FILTERS } from "@/lib/recruitment/shared/pipeline-stage-groups";
import type { RecruitmentPipelineStage } from "@/generated/prisma/enums";

/**
 * Bell lines for hiring batches, worked out each time the bell opens:
 * managers see who is waiting for them and new comments from HR; HR sees
 * what managers decided and said in the last day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MANAGER_ROUND = PIPELINE_BOARD_COLUMN_FILTERS.find((g) => g.id === "manager_round")!
  .stages as readonly RecruitmentPipelineStage[];

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export async function batchBellItems(session: SessionUser, now = new Date()): Promise<NotificationCenterItem[]> {
  if (!isRecruitmentModuleEnabled()) return [];
  const since = new Date(now.getTime() - DAY_MS);
  const items: NotificationCenterItem[] = [];

  if (canAccessRecruitmentAdministration(session)) {
    // Someone a batch is shared with = a manager; HR's own moves aren't news to HR.
    const byManagers = { hiringBatchShares: { some: {} } };
    const [decided, comments] = await Promise.all([
      prisma.applicationStageHistory.count({
        where: {
          createdAt: { gte: since },
          toStage: { in: ["decision", "on_hold", "rejected"] },
          actor: byManagers,
        },
      }),
      prisma.candidateNote.count({
        where: {
          createdAt: { gte: since },
          deletedAt: null,
          visibility: "team",
          author: byManagers,
        },
      }),
    ]);
    if (decided > 0) {
      items.push({
        id: "batch-manager-decisions",
        title: `Managers decided ${plural(decided, "candidate", "candidates")}`,
        description: "Hire, Reject or Hold in the last day. Hired people need an offer.",
        href: "/admin/recruitment",
        severity: "info",
        createdAt: now,
      });
    }
    if (comments > 0) {
      items.push({
        id: "batch-manager-comments",
        title: `${plural(comments, "new comment", "new comments")} from managers`,
        description: "On candidates in your batches, in the last day",
        href: "/admin/recruitment",
        severity: "info",
        createdAt: now,
      });
    }
    return items;
  }

  const shared = { batch: { deletedAt: null, status: "open" as const, managers: { some: { userId: session.id } } } };
  const [waiting, comments] = await Promise.all([
    prisma.hiringBatchMember.count({
      where: {
        ...shared,
        application: { deletedAt: null, status: "active", currentStage: { in: [...MANAGER_ROUND] } },
      },
    }),
    prisma.candidateNote.count({
      where: {
        createdAt: { gte: since },
        deletedAt: null,
        visibility: "team",
        authorUserId: { not: session.id },
        candidate: { applications: { some: { deletedAt: null, batchMemberships: { some: shared } } } },
      },
    }),
  ]);
  if (waiting > 0) {
    items.push({
      id: "batch-waiting-for-manager",
      title: `${plural(waiting, "candidate", "candidates")} waiting for your decision`,
      description: "Manager Round in batches HR shared with you",
      href: "/employee/hiring",
      severity: "warning",
      createdAt: now,
    });
  }
  if (comments > 0) {
    items.push({
      id: "batch-comments-for-manager",
      title: `${plural(comments, "new comment", "new comments")} from HR`,
      description: "On candidates in your batches, in the last day",
      href: "/employee/hiring",
      severity: "info",
      createdAt: now,
    });
  }
  return items;
}
