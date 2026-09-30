import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAppError = vi.fn(async () => {});
vi.mock("@/lib/observability/error-log", () => ({
  recordAppError: (...a: unknown[]) => recordAppError(...a),
}));

import { logger } from "@/lib/observability/logger";
import { onRequestError } from "@/instrumentation";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("error capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logger.error persists under the correlation id users see as Ref", async () => {
    logger.error("recruitment.action.unexpected_error", {
      correlationId: "action-error-abc",
      entityType: "action",
      message: "Gemini request failed",
      stack: "Error: Gemini request failed\n    at parse",
    });
    await flush();

    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: "action-error-abc",
        source: "log",
        event: "recruitment.action.unexpected_error",
        message: "Gemini request failed",
        error: expect.objectContaining({ stack: "Error: Gemini request failed\n    at parse" }),
        context: { entityType: "action" },
      })
    );
  });

  it("logger.warn does not persist", async () => {
    logger.warn("something.minor", { message: "x" });
    await flush();
    expect(recordAppError).not.toHaveBeenCalled();
  });

  it("onRequestError records uncaught errors by digest and skips redirects", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const context = {
      routerKind: "App Router",
      routePath: "/admin/employees/[id]",
      routeType: "render",
      renderSource: "react-server-components",
      revalidateReason: undefined,
    } as const;
    const request = { path: "/admin/employees/42", method: "GET", headers: {} };

    await onRequestError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }), request, context);
    expect(recordAppError).not.toHaveBeenCalled();

    await onRequestError(Object.assign(new Error("boom"), { digest: "2781937466" }), request, context);
    expect(recordAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: "2781937466",
        source: "request",
        event: "request.unhandled_error.render",
        path: "/admin/employees/42",
        method: "GET",
        routeType: "render",
        context: expect.objectContaining({ routePath: "/admin/employees/[id]" }),
      })
    );
    vi.unstubAllEnvs();
  });
});
