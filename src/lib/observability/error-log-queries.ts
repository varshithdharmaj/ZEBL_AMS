import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const ERROR_LOG_PAGE_SIZE = 25;

export type AppErrorLogRow = {
  id: string;
  ref: string;
  source: string;
  event: string;
  message: string;
  errorName: string | null;
  stack: string | null;
  path: string | null;
  method: string | null;
  routeType: string | null;
  userEmail: string | null;
  context: unknown;
  createdAt: string;
};

export type AppErrorLogSearch =
  | { ok: true; rows: AppErrorLogRow[]; total: number; pageSize: number }
  | { ok: false; reason: "table_missing" };

/**
 * Newest-first error rows. `q` matches the reference users copy from the red
 * "Ref: …" message (partial is fine), plus message, event, path and user email.
 */
export async function searchAppErrors({
  q,
  page = 1,
}: {
  q?: string;
  page?: number;
}): Promise<AppErrorLogSearch> {
  const term = q?.trim().replace(/^.*Ref:\s*/i, "");
  const where: Prisma.AppErrorLogWhereInput = term
    ? {
        OR: [
          { ref: { contains: term, mode: "insensitive" } },
          { message: { contains: term, mode: "insensitive" } },
          { event: { contains: term, mode: "insensitive" } },
          { path: { contains: term, mode: "insensitive" } },
          { userEmail: { contains: term, mode: "insensitive" } },
        ],
      }
    : {};
  try {
    const [rows, total] = await Promise.all([
      prisma.appErrorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * ERROR_LOG_PAGE_SIZE,
        take: ERROR_LOG_PAGE_SIZE,
      }),
      prisma.appErrorLog.count({ where }),
    ]);
    return {
      ok: true,
      total,
      pageSize: ERROR_LOG_PAGE_SIZE,
      rows: rows.map((r) => ({
        id: r.id,
        ref: r.ref,
        source: r.source,
        event: r.event,
        message: r.message,
        errorName: r.errorName,
        stack: r.stack,
        path: r.path,
        method: r.method,
        routeType: r.routeType,
        userEmail: r.userEmail,
        context: r.context,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    // P2021: table doesn't exist — the prod SQL hasn't been run yet.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return { ok: false, reason: "table_missing" };
    }
    throw error;
  }
}
