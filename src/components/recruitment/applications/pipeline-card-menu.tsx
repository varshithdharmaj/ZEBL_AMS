"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckCircle2, MoreHorizontal, PanelRightOpen, UserX, LogOut } from "lucide-react";
import { CloseApplicationDialog } from "./close-application-dialog";
import type { CloseKind } from "@/lib/recruitment/application/close-reasons";

export type CardCloseTarget = {
  id: string;
  candidateName: string;
  jobTitle: string;
};

const itemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold outline-none data-[highlighted]:bg-muted";

/** "⋯" menu on a kanban card: open details, reject or withdraw without leaving the board. */
export function PipelineCardMenu({
  target,
  onOpenDetails,
  onRequestClose,
}: {
  target: CardCloseTarget;
  onOpenDetails: () => void;
  onRequestClose: (kind: CloseKind, target: CardCloseTarget) => void;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${target.candidateName}`}
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-elevated"
        >
          <DropdownMenu.Item className={itemClass} onSelect={onOpenDetails}>
            <PanelRightOpen className="h-3.5 w-3.5" /> Open details
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={`${itemClass} text-red-600 dark:text-red-400`}
            onSelect={() => onRequestClose("reject", target)}
          >
            <UserX className="h-3.5 w-3.5" /> Reject…
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`${itemClass} text-amber-600 dark:text-amber-400`}
            onSelect={() => onRequestClose("withdraw", target)}
          >
            <LogOut className="h-3.5 w-3.5" /> Withdraw…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * One reject/withdraw dialog per board plus a short-lived confirmation, so
 * closing from a card gives feedback after the card leaves its column.
 */
export function useBoardCloseDialog() {
  const router = useRouter();
  const [request, setRequest] = useState<{ kind: CloseKind; target: CardCloseTarget } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const requestClose = (kind: CloseKind, target: CardCloseTarget) => setRequest({ kind, target });

  const element = (
    <>
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}
      {request ? (
        <CloseApplicationDialog
          kind={request.kind}
          applicationId={request.target.id}
          candidateName={request.target.candidateName}
          jobTitle={request.target.jobTitle}
          open
          onOpenChange={(open) => {
            if (!open) setRequest(null);
          }}
          onDone={() => {
            setNotice(
              `${request.target.candidateName} ${request.kind === "reject" ? "rejected" : "withdrawn"}.`
            );
            setRequest(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );

  return { requestClose, element };
}
