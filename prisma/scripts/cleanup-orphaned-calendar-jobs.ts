/**
 * One-off cleanup for dead-lettered calendar_sync/calendar_delete IntegrationJob
 * rows left behind by the bug fixed in src/lib/calendar/calendar-events.ts:
 * updateLeaveCalendarState() used to throw when the referenced LeaveRequest no
 * longer existed, so the job's own failure-handling crashed and the job
 * retried until it hit max attempts and dead-lettered.
 *
 * This marks those orphaned jobs (leaveRequestId no longer resolves to a row)
 * as completed instead of leaving them stuck in the Operations dashboard.
 *
 * Uses a standalone PrismaClient rather than importing src/lib/prisma, which
 * transitively imports `server-only` and throws under plain tsx/Node execution.
 *
 * Usage:
 *   npx tsx prisma/scripts/cleanup-orphaned-calendar-jobs.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { IntegrationJobStatus } from "@/generated/prisma/enums";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  const deadJobs = await prisma.integrationJob.findMany({
    where: {
      status: IntegrationJobStatus.failed,
      jobType: { in: ["calendar_sync", "calendar_delete"] },
    },
  });

  let cleaned = 0;
  for (const job of deadJobs) {
    const payload = JSON.parse(job.payload) as { leaveRequestId?: number };
    if (!payload.leaveRequestId) continue;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: payload.leaveRequestId },
      select: { id: true },
    });
    if (leave) continue;

    await prisma.integrationJob.update({
      where: { id: job.id },
      data: {
        status: IntegrationJobStatus.completed,
        completedAt: new Date(),
        lastError: "Orphaned: leave request no longer exists (cleaned up manually)",
      },
    });
    cleaned += 1;
  }

  console.log(`Cleaned up ${cleaned} of ${deadJobs.length} dead-lettered calendar jobs.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
