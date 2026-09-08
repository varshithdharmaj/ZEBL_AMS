import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

const DEFAULTS = [
  { name: "Morning Shift", startTime: "09:00", endTime: "18:00", graceMinutes: 10, expectedWorkMinutes: 480 },
  { name: "Night Shift", startTime: "20:00", endTime: "05:00", graceMinutes: 10, expectedWorkMinutes: 480 },
  { name: "US Shift", startTime: "18:30", endTime: "03:30", graceMinutes: 10, expectedWorkMinutes: 480 },
  { name: "General Shift", startTime: "10:00", endTime: "19:00", graceMinutes: 10, expectedWorkMinutes: 480 },
];

async function main() {
  for (const shift of DEFAULTS) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      create: shift,
      update: {},
    });
  }
  console.log(`Seeded ${DEFAULTS.length} default shifts (skipped any that already existed).`);
}

main().finally(() => prisma.$disconnect());
