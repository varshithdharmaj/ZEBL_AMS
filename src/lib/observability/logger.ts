import { createCorrelationId } from "@/lib/observability/correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  correlationId?: string;
  worker?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};

function redactContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (/password|secret|token|authorization|cookie|bearer|cron/i.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const safe = redactContext(context);
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: safe?.correlationId ?? createCorrelationId("log"),
    ...safe,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Statically false in edge bundles, so the Prisma-backed store is never
  // bundled there (see onRequestError in instrumentation.ts).
  if (level === "error" && process.env.NEXT_RUNTIME !== "edge") {
    persistError(message, entry.correlationId, safe);
  }
}

/**
 * Mirror errors into app_error_logs (admin Error Log page) under the same
 * correlation id users see as "Ref: …". Fire-and-forget; recordAppError
 * never throws and never logs through this logger, so it can't recurse.
 */
function persistError(event: string, ref: string, context?: LogContext): void {
  const { message, error, stack, correlationId: _ref, ...rest } = context ?? {};
  void _ref;
  const detail = message ?? error;
  void import("@/lib/observability/error-log")
    .then(({ recordAppError }) =>
      recordAppError({
        ref,
        source: "log",
        event,
        error:
          typeof stack === "string"
            ? Object.assign(new Error(String(detail ?? event)), { stack })
            : undefined,
        message: detail !== undefined ? String(detail) : event,
        context: rest,
      })
    )
    .catch(() => {});
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
