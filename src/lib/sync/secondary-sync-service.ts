import "server-only";

import type { Pool } from "pg";
import type { PrismaClient } from "@/generated/prisma";
import { logger } from "@/lib/observability/logger";
import { getSecondaryPool } from "@/lib/sync/secondary-db";

/**
 * One-way (Supabase -> secondary DB), read-only-on-Supabase export of
 * employee personal details and leave data. Attendance/punch/check-in-out
 * data is out of scope entirely and must never be touched here — that is
 * planned for a later phase.
 *
 * The secondary DB is documented as "same schema as Supabase, but some
 * tables not updated" (drifted). We never rely on Prisma's generated types
 * against it: every write introspects the target table's real columns and
 * only sends the intersection with our whitelist, so a missing/renamed
 * column there degrades to "skip that column", not a crashed run.
 */

const CURSOR_TABLE = "zebl_sync_cursor";

type SyncOutcome = {
  entity: string;
  synced: number;
  skipped?: string[];
  error?: string;
};

async function ensureCursorTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${CURSOR_TABLE} (
      entity TEXT PRIMARY KEY,
      last_synced_at TIMESTAMPTZ NOT NULL
    )
  `);
}

async function getCursor(pool: Pool, entity: string): Promise<Date> {
  const res = await pool.query<{ last_synced_at: Date }>(
    `SELECT last_synced_at FROM ${CURSOR_TABLE} WHERE entity = $1`,
    [entity]
  );
  return res.rows[0]?.last_synced_at ?? new Date(0);
}

async function setCursor(pool: Pool, entity: string, at: Date): Promise<void> {
  await pool.query(
    `INSERT INTO ${CURSOR_TABLE} (entity, last_synced_at) VALUES ($1, $2)
     ON CONFLICT (entity) DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at`,
    [entity, at]
  );
}

async function getExistingColumns(pool: Pool, table: string): Promise<Set<string>> {
  const res = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r) => r.column_name));
}

/** Upserts rows into `table` using only columns present in both the row and the target table. */
async function upsertRows(
  pool: Pool,
  table: string,
  conflictColumn: string,
  rows: Record<string, unknown>[]
): Promise<{ synced: number; skippedColumns: string[] }> {
  if (rows.length === 0) return { synced: 0, skippedColumns: [] };

  const existingColumns = await getExistingColumns(pool, table);
  if (existingColumns.size === 0) {
    throw new Error(`Target table "${table}" does not exist in the secondary DB`);
  }

  const desiredColumns = Object.keys(rows[0]);
  const columns = desiredColumns.filter((c) => existingColumns.has(c));
  const skippedColumns = desiredColumns.filter((c) => !existingColumns.has(c));
  if (!columns.includes(conflictColumn)) {
    throw new Error(`Target table "${table}" is missing conflict column "${conflictColumn}"`);
  }

  const updateColumns = columns.filter((c) => c !== conflictColumn);
  const setClause = updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");

  let synced = 0;
  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const columnList = columns.map((c) => `"${c}"`).join(", ");
    const sql = updateColumns.length
      ? `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})
         ON CONFLICT ("${conflictColumn}") DO UPDATE SET ${setClause}`
      : `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})
         ON CONFLICT ("${conflictColumn}") DO NOTHING`;
    await pool.query(sql, values);
    synced += 1;
  }

  return { synced, skippedColumns };
}

async function syncEmployees(prisma: PrismaClient, pool: Pool): Promise<SyncOutcome> {
  const entity = "employees";
  const since = await getCursor(pool, entity);
  const employees = await prisma.employee.findMany({
    where: { updatedAt: { gt: since } },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      gender: true,
      dateOfBirth: true,
      email: true,
      phone: true,
      alternatePhone: true,
      address: true,
      emergencyContact: true,
      department: true,
      designation: true,
      employmentType: true,
      workLocation: true,
      joiningDate: true,
      employeeStatus: true,
      isActive: true,
      managerId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  if (employees.length === 0) return { entity, synced: 0 };

  const { synced, skippedColumns } = await upsertRows(
    pool,
    "employees",
    "id",
    employees.map((e) => ({
      id: e.id,
      employee_code: e.employeeCode,
      name: e.name,
      first_name: e.firstName,
      last_name: e.lastName,
      preferred_name: e.preferredName,
      gender: e.gender,
      date_of_birth: e.dateOfBirth,
      email: e.email,
      phone: e.phone,
      alternate_phone: e.alternatePhone,
      address: e.address,
      emergency_contact: e.emergencyContact,
      department: e.department,
      designation: e.designation,
      employment_type: e.employmentType,
      work_location: e.workLocation,
      joining_date: e.joiningDate,
      employee_status: e.employeeStatus,
      is_active: e.isActive,
      manager_id: e.managerId,
      updated_at: e.updatedAt,
    }))
  );

  const maxUpdatedAt = employees[employees.length - 1].updatedAt;
  await setCursor(pool, entity, maxUpdatedAt);
  return { entity, synced, skipped: skippedColumns.length ? skippedColumns : undefined };
}

async function syncLeaveRequests(prisma: PrismaClient, pool: Pool): Promise<SyncOutcome> {
  const entity = "leave_requests";
  const since = await getCursor(pool, entity);
  const requests = await prisma.leaveRequest.findMany({
    where: { createdAt: { gt: since } },
    select: {
      id: true,
      employeeId: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      days: true,
      lopDays: true,
      reason: true,
      status: true,
      workflowStatus: true,
      submittedAt: true,
      rejectionReason: true,
      cancelledAt: true,
      withdrawnAt: true,
      finalApprovedAt: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (requests.length === 0) return { entity, synced: 0 };

  const { synced, skippedColumns } = await upsertRows(
    pool,
    "leave_requests",
    "id",
    requests.map((r) => ({
      id: r.id,
      employee_id: r.employeeId,
      leave_type: r.leaveType,
      start_date: r.startDate,
      end_date: r.endDate,
      days: r.days,
      lop_days: r.lopDays,
      reason: r.reason,
      status: r.status,
      workflow_status: r.workflowStatus,
      submitted_at: r.submittedAt,
      rejection_reason: r.rejectionReason,
      cancelled_at: r.cancelledAt,
      withdrawn_at: r.withdrawnAt,
      final_approved_at: r.finalApprovedAt,
      reviewed_by: r.reviewedBy,
      reviewed_at: r.reviewedAt,
      created_at: r.createdAt,
    }))
  );

  await setCursor(pool, entity, requests[requests.length - 1].createdAt ?? new Date());
  return { entity, synced, skipped: skippedColumns.length ? skippedColumns : undefined };
}

async function syncLeaveBalances(prisma: PrismaClient, pool: Pool): Promise<SyncOutcome> {
  const entity = "employee_leave_balances";
  const since = await getCursor(pool, entity);
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: { updatedAt: { gt: since } },
    select: {
      id: true,
      employeeId: true,
      elBalance: true,
      clBalance: true,
      slBalance: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  if (balances.length === 0) return { entity, synced: 0 };

  const { synced, skippedColumns } = await upsertRows(
    pool,
    "employee_leave_balances",
    "id",
    balances.map((b) => ({
      id: b.id,
      employee_id: b.employeeId,
      el_balance: b.elBalance,
      cl_balance: b.clBalance,
      sl_balance: b.slBalance,
      updated_at: b.updatedAt,
    }))
  );

  await setCursor(pool, entity, balances[balances.length - 1].updatedAt);
  return { entity, synced, skipped: skippedColumns.length ? skippedColumns : undefined };
}

/**
 * Runs the full sync. Never throws: every entity is isolated in its own
 * try/catch so a failure in one (or a secondary DB outage) cannot affect
 * the others, and cannot propagate back to anything touching Supabase.
 */
export async function runSecondaryDbSync(
  prisma: PrismaClient
): Promise<{ ranAt: string; results: SyncOutcome[] }> {
  const pool = getSecondaryPool();
  const ranAt = new Date().toISOString();
  if (!pool) {
    logger.info("[secondary-db-sync] disabled (SECONDARY_DATABASE_URL not set)");
    return { ranAt, results: [] };
  }

  try {
    await ensureCursorTable(pool);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[secondary-db-sync] could not prepare cursor table, aborting run", { error: message });
    return { ranAt, results: [{ entity: "cursor_table", synced: 0, error: message }] };
  }

  const tasks: { entity: string; run: () => Promise<SyncOutcome> }[] = [
    { entity: "employees", run: () => syncEmployees(prisma, pool) },
    { entity: "leave_requests", run: () => syncLeaveRequests(prisma, pool) },
    { entity: "employee_leave_balances", run: () => syncLeaveBalances(prisma, pool) },
  ];

  const results: SyncOutcome[] = [];
  for (const task of tasks) {
    try {
      const outcome = await task.run();
      if (outcome.skipped?.length) {
        logger.warn("[secondary-db-sync] target table missing columns, skipped", {
          entity: outcome.entity,
          columns: outcome.skipped.join(","),
        });
      }
      results.push(outcome);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[secondary-db-sync] entity sync failed", { entity: task.entity, error: message });
      results.push({ entity: task.entity, synced: 0, error: message });
    }
  }

  return { ranAt, results };
}
