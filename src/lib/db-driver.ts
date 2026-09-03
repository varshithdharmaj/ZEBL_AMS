import { getEnv } from "@/lib/config/env";

export type DbDriver = "postgresql" | "mysql";

/**
 * Which database dialect raw-SQL helpers (db-lock, db-sequence, queue-lock,
 * ensure-import-job-schema) should target.
 *
 * Defaults to "postgresql" — the app's DATABASE_URL / prisma/schema.prisma
 * pipeline — so leaving DB_DRIVER unset changes nothing for any existing
 * deployment. Set DB_DRIVER=mysql only when the active Prisma client was
 * generated from prisma-mysql/schema.prisma (DATABASE_MYSQL_URL).
 */
export function getDbDriver(): DbDriver {
  return getEnv("DB_DRIVER") === "mysql" ? "mysql" : "postgresql";
}
