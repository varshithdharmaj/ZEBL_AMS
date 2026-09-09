import { PrismaClient } from "@/generated/prisma/client";
import { DEPARTMENTS } from "@/lib/employee-types";

const prisma = new PrismaClient();

async function main() {
  const stale = await prisma.employee.findMany({
    where: {
      department: { not: null },
      NOT: { department: { in: [...DEPARTMENTS] } },
    },
    select: { id: true, employeeCode: true, name: true, department: true },
  });

  if (stale.length === 0) {
    console.log("No employees with a non-canonical department. Nothing to do.");
    return;
  }

  console.log(`Clearing department on ${stale.length} employee(s):`);
  for (const e of stale) {
    console.log(`  #${e.id} ${e.employeeCode} ${e.name} — "${e.department}"`);
  }

  const result = await prisma.employee.updateMany({
    where: { id: { in: stale.map((e) => e.id) } },
    data: { department: null },
  });

  console.log(`Cleared department on ${result.count} employee(s).`);
}

main().finally(() => prisma.$disconnect());
