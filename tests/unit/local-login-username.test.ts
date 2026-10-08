import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => userFindFirst(...args),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

const { authenticateLocalUser } = await import("@/lib/auth/providers/local-provider");

describe("local login by username", () => {
  beforeEach(() => {
    userFindFirst.mockReset();
  });

  it("looks the login up by username (any case) or by login email", async () => {
    userFindFirst.mockResolvedValue(null);

    await authenticateLocalUser({ username: "  Emp660052 ", password: "x" });

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { equals: "Emp660052", mode: "insensitive" } },
            { email: "emp660052" },
          ],
        },
      })
    );
  });

  it("rejects a wrong password with the username wording", async () => {
    userFindFirst.mockResolvedValue({
      id: "u1",
      password: await bcrypt.hash("RightPass1", 4),
      isActive: true,
      employee: null,
    });

    const result = await authenticateLocalUser({ username: "660052", password: "WrongPass1" });

    expect(result).toMatchObject({ ok: false, code: "invalid_credentials", message: "Wrong username or password." });
  });

  it("rejects an unknown username", async () => {
    userFindFirst.mockResolvedValue(null);

    const result = await authenticateLocalUser({ username: "nobody", password: "x" });

    expect(result).toMatchObject({ ok: false, code: "invalid_credentials" });
  });
});
