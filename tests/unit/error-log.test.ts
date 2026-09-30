import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn(async () => ({}));
const deleteMany = vi.fn(async () => ({ count: 0 }));

vi.mock("@/lib/prisma", () => ({
  prisma: { appErrorLog: { create: (...a: unknown[]) => create(...a), deleteMany: (...a: unknown[]) => deleteMany(...a) } },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ referer: "https://hrms.example.com/admin/recruitment/candidates/new?method=parsing" }),
}));
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ id: "user_1", email: "hr@example.com" }),
}));

import { recordAppError, sanitizeErrorContext } from "@/lib/observability/error-log";

describe("sanitizeErrorContext", () => {
  it("redacts secrets and file bodies at any depth", () => {
    expect(
      sanitizeErrorContext({
        entityType: "action",
        apiKey: "sk-live",
        nested: { password: "x", authorization: "Bearer y", content: "resume bytes", ok: 1 },
      })
    ).toEqual({
      entityType: "action",
      apiKey: "[redacted]",
      nested: { password: "[redacted]", authorization: "[redacted]", content: "[redacted]", ok: 1 },
    });
  });

  it("bounds oversized context", () => {
    const big = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, "x".repeat(400)]));
    const out = sanitizeErrorContext(big)!;
    expect(Object.keys(out)).toEqual(["truncated"]);
    expect(String(out.truncated).length).toBeLessThan(8_100);
  });
});

describe("recordAppError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saves the error under its ref with request user and page", async () => {
    await recordAppError({
      ref: "action-error-c1c8a7fa-2b9",
      source: "log",
      event: "recruitment.action.unexpected_error",
      error: new TypeError("fetch failed"),
      context: { entityType: "action", token: "abc" },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ref: "action-error-c1c8a7fa-2b9",
        source: "log",
        event: "recruitment.action.unexpected_error",
        message: "fetch failed",
        errorName: "TypeError",
        stack: expect.stringContaining("TypeError: fetch failed"),
        path: "/admin/recruitment/candidates/new?method=parsing",
        userId: "user_1",
        userEmail: "hr@example.com",
        context: { entityType: "action", token: "[redacted]" },
      }),
    });
  });

  it("never throws when the table is missing", async () => {
    create.mockRejectedValueOnce(new Error('relation "app_error_logs" does not exist'));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAppError({ ref: "r1", source: "request", event: "e", error: new Error("boom") })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("error_log.persist_failed"));
    spy.mockRestore();
  });

  it("is a no-op in tests and when switched off", async () => {
    vi.stubEnv("ERROR_LOG_DB", "off");
    await recordAppError({ ref: "r2", source: "log", event: "e" });
    expect(create).not.toHaveBeenCalled();
  });
});
