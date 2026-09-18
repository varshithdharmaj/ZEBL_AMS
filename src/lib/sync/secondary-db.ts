import "server-only";

import { Pool } from "pg";
import { logger } from "@/lib/observability/logger";

/**
 * Standalone connection to the secondary Postgres DB used for the temporary
 * leave/employee-details export (phase-1 of the future attendance sync).
 * Deliberately not the Prisma client / pool from src/lib/prisma.ts — this
 * pool, its errors, and its lifecycle must never be able to affect the
 * Supabase connection the app runs on.
 */

type SecondaryDbGlobal = {
  secondaryPool?: Pool | null;
};

const globalForSecondaryDb = globalThis as typeof globalThis & SecondaryDbGlobal;

export function isSecondaryDbEnabled(): boolean {
  const url = process.env.SECONDARY_DATABASE_URL;
  return typeof url === "string" && url.trim() !== "";
}

/**
 * Returns the secondary pool, or null if SECONDARY_DATABASE_URL is unset.
 * Never throws — a misconfigured or unreachable secondary DB must never
 * break callers that also touch Supabase in the same process.
 */
export function getSecondaryPool(): Pool | null {
  if (!isSecondaryDbEnabled()) return null;
  if (globalForSecondaryDb.secondaryPool !== undefined) {
    return globalForSecondaryDb.secondaryPool;
  }

  const url = process.env.SECONDARY_DATABASE_URL!;
  try {
    const pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // pg pools emit 'error' on idle-client failures; without a listener that
    // is an unhandled exception that could crash the whole process, taking
    // the Supabase connection down with it. Swallow-and-log instead.
    pool.on("error", (err) => {
      logger.error("[secondary-db] pool error", { error: err.message });
    });
    globalForSecondaryDb.secondaryPool = pool;
    return pool;
  } catch (err) {
    logger.error("[secondary-db] failed to create pool", {
      error: err instanceof Error ? err.message : String(err),
    });
    globalForSecondaryDb.secondaryPool = null;
    return null;
  }
}

export async function closeSecondaryPool(): Promise<void> {
  const pool = globalForSecondaryDb.secondaryPool;
  if (!pool) return;
  globalForSecondaryDb.secondaryPool = undefined;
  await pool.end().catch((err) => {
    logger.error("[secondary-db] error closing pool", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
