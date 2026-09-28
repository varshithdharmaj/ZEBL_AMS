import { prisma } from "../../src/lib/prisma";
import { runSecondaryDbSync } from "../../src/lib/sync/secondary-sync-service";
import { closeSecondaryPool } from "../../src/lib/sync/secondary-db";
import { runManagedWorkerCli } from "../../src/lib/workers/worker-manager";

void runManagedWorkerCli({
  name: "secondary-db-sync",
  intervalMs: parseInt(process.env.WORKER_INTERVAL_MS ?? "300000", 10),
  runOnce: async () => {
    const { ranAt, results } = await runSecondaryDbSync(prisma);
    return { ranAt, results } as Record<string, unknown>;
  },
  onShutdown: async () => {
    await closeSecondaryPool();
  },
});
