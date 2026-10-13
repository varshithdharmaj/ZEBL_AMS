import "server-only";

import { prisma } from "@/lib/prisma";

/** The numbers and short lists around the batch boxes on the recruitment dashboard. */

export type DashboardPerson = {
  id: string;
  name: string;
  role: string;
  /** When they applied, the offer was sent, or the offer was accepted. */
  date: Date | null;
  /** Where clicking the row goes. */
  href: string;
};

export type DashboardSummary = {
  openJobs: number;
  inProgress: number;
  newCandidates: { count: number; items: DashboardPerson[] };
  offersWaiting: { count: number; items: DashboardPerson[] };
  readyToJoin: { count: number; items: DashboardPerson[] };
};

const LIST_SIZE = 5;

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const liveApp = { deletedAt: null } as const;
  // Still being considered, and not in an open batch yet.
  const notInBatch = {
    ...liveApp,
    status: "active" as const,
    batchMemberships: { none: { batch: { status: "open" as const, deletedAt: null } } },
  };
  const waiting = { status: "released" as const, application: liveApp };
  const accepted = { status: "accepted" as const, application: { ...liveApp, conversionSnapshot: null } };
  const appSelect = { candidate: { select: { fullName: true } }, jobOpening: { select: { title: true } } } as const;

  const [openJobs, inProgress, newCount, newItems, waitingCount, waitingItems, acceptedCount, acceptedItems] =
    await Promise.all([
      prisma.jobOpening.count({ where: { status: "open", deletedAt: null } }),
      prisma.application.count({ where: { ...liveApp, status: { in: ["active", "on_hold"] } } }),
      prisma.application.count({ where: notInBatch }),
      prisma.application.findMany({
        where: notInBatch,
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
        select: { id: true, createdAt: true, ...appSelect },
      }),
      prisma.offer.count({ where: waiting }),
      prisma.offer.findMany({
        where: waiting,
        orderBy: [{ sentAt: { sort: "asc", nulls: "last" } }, { releasedAt: "asc" }],
        take: LIST_SIZE,
        select: { id: true, sentAt: true, releasedAt: true, application: { select: appSelect } },
      }),
      prisma.offer.count({ where: accepted }),
      prisma.offer.findMany({
        where: accepted,
        orderBy: { acceptedAt: "asc" },
        take: LIST_SIZE,
        select: { id: true, acceptedAt: true, application: { select: appSelect } },
      }),
    ]);

  return {
    openJobs,
    inProgress,
    newCandidates: {
      count: newCount,
      items: newItems.map((a) => ({
        id: a.id,
        name: a.candidate.fullName,
        role: a.jobOpening.title,
        date: a.createdAt,
        href: `/admin/recruitment/pipeline?applicationId=${a.id}`,
      })),
    },
    offersWaiting: {
      count: waitingCount,
      items: waitingItems.map((o) => ({
        id: o.id,
        name: o.application.candidate.fullName,
        role: o.application.jobOpening.title,
        date: o.sentAt ?? o.releasedAt,
        href: `/admin/recruitment/offers/${o.id}`,
      })),
    },
    readyToJoin: {
      count: acceptedCount,
      items: acceptedItems.map((o) => ({
        id: o.id,
        name: o.application.candidate.fullName,
        role: o.application.jobOpening.title,
        date: o.acceptedAt,
        href: `/admin/recruitment/conversions/${o.id}`,
      })),
    },
  };
}
