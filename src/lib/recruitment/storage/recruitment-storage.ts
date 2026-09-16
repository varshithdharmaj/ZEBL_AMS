import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { createConfiguredStorage } from "@/lib/recruitment/storage/configured-storage";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";

let cached: StorageAdapter | null = null;

export function getRecruitmentStorageRoot(): string {
  return (
    getEnv("RECRUITMENT_STORAGE_ROOT") ??
    path.join(process.cwd(), "storage", "recruitment")
  );
}

/** Process-singleton storage adapter (local FS or S3). */
export function getRecruitmentStorage(): StorageAdapter {
  if (!cached) {
    cached = createConfiguredStorage({
      envPrefix: "RECRUITMENT",
      localRoot: getRecruitmentStorageRoot(),
      defaultS3Prefix: "recruitment",
    });
  }
  return cached;
}

/** Test helper — replace singleton. */
export function setRecruitmentStorageForTests(adapter: StorageAdapter | null): void {
  cached = adapter;
}
