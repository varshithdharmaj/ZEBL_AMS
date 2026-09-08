/**
 * In-memory preview cache — parse once, confirm reuses rows.
 * Single-process TTL store (no schema). Entries are scoped by userId.
 */

import type { LeaveBalanceImportCacheEntry } from "./preview-types";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 50;

type GlobalCache = {
  __amsLeaveBalanceImportPreviewCache?: Map<string, LeaveBalanceImportCacheEntry>;
};

function store(): Map<string, LeaveBalanceImportCacheEntry> {
  const g = globalThis as typeof globalThis & GlobalCache;
  if (!g.__amsLeaveBalanceImportPreviewCache) {
    g.__amsLeaveBalanceImportPreviewCache = new Map();
  }
  return g.__amsLeaveBalanceImportPreviewCache;
}

function purgeExpired(now = Date.now()): void {
  const map = store();
  for (const [id, entry] of map) {
    if (entry.expiresAt <= now) map.delete(id);
  }
  if (map.size <= MAX_ENTRIES) return;
  const ordered = [...map.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  const overflow = map.size - MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    map.delete(ordered[i][0]);
  }
}

export function putLeaveBalanceImportPreviewCache(
  entry: Omit<LeaveBalanceImportCacheEntry, "createdAt" | "expiresAt"> & {
    createdAt?: number;
    expiresAt?: number;
  }
): LeaveBalanceImportCacheEntry {
  purgeExpired();
  const createdAt = entry.createdAt ?? Date.now();
  const full: LeaveBalanceImportCacheEntry = {
    ...entry,
    createdAt,
    expiresAt: entry.expiresAt ?? createdAt + TTL_MS,
  };
  store().set(full.previewId, full);
  return full;
}

export function getLeaveBalanceImportPreviewCache(
  previewId: string,
  userId: string
): LeaveBalanceImportCacheEntry | null {
  purgeExpired();
  const entry = store().get(previewId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  if (entry.expiresAt <= Date.now()) {
    store().delete(previewId);
    return null;
  }
  return entry;
}

export function deleteLeaveBalanceImportPreviewCache(previewId: string, userId: string): boolean {
  const entry = store().get(previewId);
  if (!entry || entry.userId !== userId) return false;
  store().delete(previewId);
  return true;
}
