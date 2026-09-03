import { prisma } from "@/lib/prisma";

export const STUCK_PROCESSING_MS = 15 * 60 * 1000;

export async function releaseStuckNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const result = await prisma.notification.updateMany({
    where: {
      status: "processing",
      OR: [
        { lockedAt: { lt: cutoff } },
        { lockedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

export async function releaseStuckIntegrationJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const result = await prisma.integrationJob.updateMany({
    where: {
      status: "processing",
      OR: [
        { lockedAt: { lt: cutoff } },
        { lockedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

/**
 * Claims due notifications via SELECT ... FOR UPDATE SKIP LOCKED followed by
 * a typed updateMany, both inside one transaction so the claim is atomic.
 *
 * Previously a single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP
 * LOCKED) RETURNING id` — PostgreSQL-only syntax (`RETURNING`, `::"Enum"`
 * casts). FOR UPDATE SKIP LOCKED itself is supported by both PostgreSQL and
 * MySQL 8+, so only the id-selection query is raw SQL now; the actual claim
 * write goes through Prisma Client, which is already dialect-portable.
 */
export async function claimDueNotificationIds(
  limit: number,
  workerId: string,
  maxAttempts: number
): Promise<string[]> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM notifications
      WHERE status = 'pending'
        AND scheduled_at <= ${now}
        AND attempts < ${maxAttempts}
      ORDER BY scheduled_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];

    await tx.notification.updateMany({
      where: { id: { in: ids } },
      data: { status: "processing", lockedAt: now, lockedBy: workerId, updatedAt: now },
    });
    return ids;
  });
}

/** Claims due integration jobs — see claimDueNotificationIds for the pattern. */
export async function claimDueIntegrationJobIds(
  limit: number,
  workerId: string,
  maxAttempts: number
): Promise<string[]> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM integration_jobs
      WHERE status = 'pending'
        AND scheduled_at <= ${now}
        AND attempts < ${maxAttempts}
      ORDER BY scheduled_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];

    await tx.integrationJob.updateMany({
      where: { id: { in: ids } },
      data: { status: "processing", lockedAt: now, lockedBy: workerId, updatedAt: now },
    });
    return ids;
  });
}
