import crypto from "node:crypto";
import { getDbDriver } from "@/lib/db-driver";

/**
 * Minimal shape both the PostgreSQL and MySQL Prisma clients (and their
 * $transaction interactive-transaction clients) satisfy — enough to run the
 * raw SQL below regardless of which one is active.
 */
export interface RawSqlClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

const MYSQL_LOCK_NAME_MAX_BYTES = 64;

/** MySQL GET_LOCK() names are capped at 64 bytes; hash anything longer. */
function mysqlLockName(lockKey: string): string {
  if (Buffer.byteLength(lockKey, "utf8") <= MYSQL_LOCK_NAME_MAX_BYTES) return lockKey;
  return crypto.createHash("sha1").update(lockKey).digest("hex"); // 40 chars
}

/**
 * Acquires a named, serialized lock scoped to `lockKey` for the duration of
 * `fn`, using the connection's active dialect:
 *
 * - PostgreSQL: `pg_advisory_xact_lock(hashtext(...))` — transaction-scoped,
 *   released automatically on commit/rollback. `tx` MUST be an interactive
 *   transaction client (the lock is meaningless outside one).
 * - MySQL: `GET_LOCK(...)` / `RELEASE_LOCK(...)` — session-scoped, not
 *   transaction-scoped, so it is released explicitly in `finally`. Requires
 *   `tx` to keep a single underlying connection for the whole call (true for
 *   a Prisma interactive transaction, false for the bare `prisma` client).
 *
 * Replaces the direct `pg_advisory_xact_lock(hashtext(...))` calls previously
 * inlined in candidate-ai-recovery-service.ts, candidate-ai-enrichment-service.ts,
 * and biometric-attendance-derivation.ts.
 */
export async function withDbLock<T>(
  tx: RawSqlClient,
  lockKey: string,
  fn: () => Promise<T>,
  timeoutSeconds = 10
): Promise<T> {
  const driver = getDbDriver();

  if (driver === "mysql") {
    const lockName = mysqlLockName(lockKey);
    const rows = await tx.$queryRaw<Array<Record<string, number | null>>>`
      SELECT GET_LOCK(${lockName}, ${timeoutSeconds}) AS result
    `;
    const acquired = Object.values(rows[0] ?? {})[0];
    if (acquired !== 1) {
      throw new Error(`[db-lock] Could not acquire MySQL lock "${lockKey}" within ${timeoutSeconds}s`);
    }
    try {
      return await fn();
    } finally {
      await tx.$executeRaw`SELECT RELEASE_LOCK(${lockName})`;
    }
  }

  // postgresql — hashtext() reduces the arbitrary-length key to a bigint the
  // way the original inline calls did; the lock is released implicitly when
  // the enclosing transaction commits or rolls back.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  return fn();
}
