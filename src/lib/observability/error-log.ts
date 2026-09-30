/**
 * Persists server errors to `app_error_logs` so they can be read from the
 * admin Error Log page — production runs on ECS where console output isn't
 * available to the team. Every function here is best-effort: it never throws
 * and never calls `logger` (which would recurse), falling back to
 * console.error when the table is missing or the database is unreachable.
 */

const MAX_MESSAGE = 2_000;
const MAX_STACK = 8_000;
const MAX_CONTEXT = 8_000;
const MAX_FIELD = 500;

/** Rows older than this are pruned opportunistically on insert. */
export const ERROR_LOG_RETENTION_DAYS = 90;
const PRUNE_PROBABILITY = 0.02;

/** Keys whose values are replaced before saving (matches logger redaction, plus file bodies). */
const REDACT_KEY = /password|secret|token|authorization|cookie|bearer|cron|api[-_]?key|content|buffer|base64/i;

export type AppErrorInput = {
  ref: string;
  source: "log" | "request";
  event: string;
  error?: unknown;
  message?: string;
  path?: string | null;
  method?: string | null;
  routeType?: string | null;
  context?: Record<string, unknown>;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max)}… [truncated ${value.length - max} chars]` : value;
}

/** Redacts secret-looking keys (recursively) and bounds the serialized size. */
export function sanitizeErrorContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!context) return null;
  const seen = new WeakSet<object>();
  const walk = (value: unknown, depth: number): unknown => {
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return truncate(value, MAX_FIELD);
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return { name: value.name, message: truncate(value.message, MAX_FIELD) };
    if (typeof value !== "object") return String(value);
    if (seen.has(value) || depth > 4) return "[omitted]";
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 20).map((v) => walk(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = REDACT_KEY.test(key) ? "[redacted]" : walk(v, depth + 1);
    }
    return out;
  };
  const cleaned = walk(context, 0) as Record<string, unknown>;
  const json = JSON.stringify(cleaned);
  return json.length > MAX_CONTEXT ? { truncated: truncate(json, MAX_CONTEXT) } : cleaned;
}

function describeError(error: unknown, fallback?: string) {
  if (error instanceof Error) {
    return { message: error.message || fallback || error.name, errorName: error.name, stack: error.stack };
  }
  if (error !== undefined) return { message: String(error), errorName: null, stack: null };
  return { message: fallback ?? "Unknown error", errorName: null, stack: null };
}

function persistenceDisabled(): boolean {
  return (
    process.env.NEXT_RUNTIME === "edge" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.ERROR_LOG_DB?.trim().toLowerCase() === "off"
  );
}

/** Who and where, when called inside a request; empty outside one (workers, startup). */
async function readRequestContext(): Promise<{
  path?: string;
  userId?: string;
  userEmail?: string;
}> {
  const out: { path?: string; userId?: string; userEmail?: string } = {};
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const referer = h.get("referer");
    if (referer) out.path = new URL(referer).pathname + new URL(referer).search;
  } catch {
    // Not in a request scope.
  }
  try {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (session) {
      out.userId = session.id;
      out.userEmail = session.email ?? undefined;
    }
  } catch {
    // No session available (outside a request, or auth itself is what failed).
  }
  return out;
}

export async function recordAppError(input: AppErrorInput): Promise<void> {
  if (persistenceDisabled()) return;
  try {
    const described = describeError(input.error, input.message);
    const request = await readRequestContext();
    const { prisma } = await import("@/lib/prisma");
    await prisma.appErrorLog.create({
      data: {
        ref: truncate(input.ref, 200)!,
        source: input.source,
        event: truncate(input.event, 200)!,
        message: truncate(input.message ?? described.message, MAX_MESSAGE)!,
        errorName: truncate(described.errorName, 200),
        stack: truncate(described.stack, MAX_STACK),
        path: truncate(input.path ?? request.path ?? null, MAX_FIELD),
        method: truncate(input.method ?? null, 20),
        routeType: truncate(input.routeType ?? null, 50),
        userId: request.userId ?? null,
        userEmail: request.userEmail ?? null,
        context: (sanitizeErrorContext(input.context) ?? undefined) as never,
      },
    });
    if (Math.random() < PRUNE_PROBABILITY) {
      const cutoff = new Date(Date.now() - ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.appErrorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (persistError) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "error_log.persist_failed",
        ref: input.ref,
        cause: persistError instanceof Error ? persistError.message : String(persistError),
      })
    );
  }
}
