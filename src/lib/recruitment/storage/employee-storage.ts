import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { createConfiguredStorage } from "@/lib/recruitment/storage/configured-storage";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";

let cached: StorageAdapter | null = null;

export function getEmployeeStorageRoot(): string {
  return getEnv("EMPLOYEE_STORAGE_ROOT") ?? path.join(process.cwd(), "storage", "employees");
}

/** Process-singleton storage adapter (local FS or S3) for employee documents. */
export function getEmployeeStorage(): StorageAdapter {
  if (!cached) {
    cached = createConfiguredStorage({
      envPrefix: "EMPLOYEE",
      localRoot: getEmployeeStorageRoot(),
      defaultS3Prefix: "employees",
    });
  }
  return cached;
}

/** Test helper — replace singleton. */
export function setEmployeeStorageForTests(adapter: StorageAdapter | null): void {
  cached = adapter;
}
