import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { initializeEmployeeLeaveBalances, processPendingLeaveAccruals } from "../src/lib/leave";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Hr@2026", 10);

  await prisma.user.upsert({
    where: { email: "hr@zebl.com" },
    update: { password: passwordHash, role: "admin" },
    create: {
      email: "hr@zebl.com",
      password: passwordHash,
      role: "admin",
    },
  });

  const employees = await prisma.employee.findMany();
  for (const emp of employees) {
    await initializeEmployeeLeaveBalances(emp.id);
    await processPendingLeaveAccruals(emp.id);
  }

  console.log("Seeded default admin: hr@zebl.com / Hr@2026");
  console.log(`Processed leave balances for ${employees.length} employee(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
