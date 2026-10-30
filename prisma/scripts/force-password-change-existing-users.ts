/**
 * One-time: make every existing local login change its password on next sign-in.
 *
 * New accounts already get mustChangePassword = true at creation; accounts created
 * before that (Excel imports with the shared default password, older manual
 * accounts) never did. This flags all of them once.
 *
 * - Only authProvider = local with a password set (SSO users have nothing to rotate).
 * - Skips accounts already flagged.
 * - Bumps sessionVersion so open sessions are signed out; the next login carries
 *   the flag and the middleware sends the user to /change-password.
 *
 * Run: npx tsx prisma/scripts/force-password-change-existing-users.ts --dry-run
 *      npx tsx prisma/scripts/force-password-change-existing-users.ts
 */
import { PrismaClient, AuthProvider } from "../../src/generated/prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

const prisma = new PrismaClient();

async function main() {
  const where = {
    authProvider: AuthProvider.local,
    password: { not: null },
    mustChangePassword: false,
  };

  const users = await prisma.user.findMany({
    where,
    select: {
      email: true,
      username: true,
      role: true,
      isActive: true,
      employee: { select: { employeeCode: true } },
    },
    orderBy: { email: "asc" },
  });

  for (const user of users) {
    const login = user.username ?? user.email;
    const code = user.employee?.employeeCode ?? "-";
    console.log(`${DRY_RUN ? "WOULD FLAG" : "FLAG"} ${login} (${user.role}, ${code}${user.isActive ? "" : ", inactive"})`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run. ${users.length} account(s) would be flagged. Re-run without --dry-run to apply.`);
    return;
  }

  // updateMany re-applies the same filter, so an account flagged between the
  // listing and this write is simply not counted twice.
  const result = await prisma.user.updateMany({
    where,
    data: {
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });

  console.log(`\nDone. Flagged ${result.count} account(s); their open sessions are signed out.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
