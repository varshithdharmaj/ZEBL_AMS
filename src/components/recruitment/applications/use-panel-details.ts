"use client";

import { useEffect, useState } from "react";
import type { PipelineDrawerApplication } from "@/components/recruitment/applications/application-pipeline-drawer";

/** Details already fetched this session, so going back to someone is instant. */
const cache = new Map<string, PipelineDrawerApplication>();

/** Drop a person's details after changing them, so the next look is fresh. */
export function forgetPanelDetails(applicationId: string) {
  cache.delete(applicationId);
}

/**
 * The panel's details for one application. Uses `given` when the page already
 * loaded them (the Pipeline); otherwise fetches them in the background.
 */
export function usePanelDetails(
  applicationId: string | null,
  given: PipelineDrawerApplication | null
): PipelineDrawerApplication | null {
  const usable = given && applicationId && given.id === applicationId ? given : null;
  const [fetched, setFetched] = useState<PipelineDrawerApplication | null>(
    applicationId ? (cache.get(applicationId) ?? null) : null
  );

  useEffect(() => {
    if (!applicationId || usable) return;
    const hit = cache.get(applicationId);
    setFetched(hit ?? null);
    if (hit) return;
    let cancelled = false;
    fetch(`/api/recruitment/applications/${encodeURIComponent(applicationId)}/panel`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { application?: PipelineDrawerApplication } | null) => {
        if (!data?.application) return;
        cache.set(applicationId, data.application);
        if (!cancelled) setFetched(data.application);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applicationId, usable]);

  if (usable) return usable;
  return fetched && fetched.id === applicationId ? fetched : null;
}
