import { closeReasonLabel, type CloseKind } from "@/lib/recruitment/application/close-reasons";

type ClosableApplication = {
  status: string;
  rejectedReason?: string | null;
  rejectionReasonCode?: string | null;
  withdrawnReason?: string | null;
  withdrawalReasonCode?: string | null;
};

/** The reason code + note for a rejected/withdrawn application, or null when it is still open. */
export function getCloseReason(app: ClosableApplication): {
  kind: CloseKind;
  label: string | null;
  note: string | null;
} | null {
  if (app.status === "rejected") {
    return {
      kind: "reject",
      label: closeReasonLabel("reject", app.rejectionReasonCode),
      note: app.rejectedReason?.trim() || null,
    };
  }
  if (app.status === "withdrawn") {
    return {
      kind: "withdraw",
      label: closeReasonLabel("withdraw", app.withdrawalReasonCode),
      note: app.withdrawnReason?.trim() || null,
    };
  }
  return null;
}

/**
 * "Rejected · Failed interview round · by Sowmya, 1 Oct" with the note
 * underneath. Renders nothing for open applications.
 */
export function CloseReasonSummary({
  application,
  closedBy,
  closedAt,
}: {
  application: ClosableApplication;
  closedBy?: string | null;
  closedAt?: Date | string | null;
}) {
  const reason = getCloseReason(application);
  if (!reason) return null;

  const isReject = reason.kind === "reject";
  const when = closedAt
    ? new Date(closedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null;
  const byLine = [closedBy ? `by ${closedBy}` : null, when].filter(Boolean).join(", ");

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-xs ${
        isReject
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      <p className="font-semibold">
        {isReject ? "Rejected" : "Withdrawn"}
        {reason.label ? ` · ${reason.label}` : ""}
        {byLine ? <span className="font-normal opacity-80"> · {byLine}</span> : null}
      </p>
      {reason.note ? <p className="mt-1 whitespace-pre-wrap leading-relaxed opacity-90">{reason.note}</p> : null}
      {!reason.label && !reason.note ? (
        <p className="mt-1 opacity-80">No reason was recorded.</p>
      ) : null}
    </div>
  );
}
