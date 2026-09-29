"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Archive,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  renamePipelineStageAction,
  movePipelineStageAction,
  archivePipelineStageAction,
} from "@/actions/recruitment-job-stages";

export type StageColumnMenuStage = {
  id: string;
  label: string;
  isSystemStage: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
};

export function StageColumnMenu({
  stage,
  onAddBefore,
  onAddAfter,
  onChanged,
}: {
  stage: StageColumnMenuStage;
  onAddBefore: () => void;
  onAddAfter: () => void;
  /** Called after a rename/move/archive succeeds — parent should router.refresh(). */
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(stage.label);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setRenaming(false);
    setRenameValue(stage.label);
  }, [stage.label]);

  // The board sits in a horizontal scroll container with stacked cards below the
  // column header, so the panel is portaled to <body> and positioned against the
  // trigger to avoid being clipped or painted under the cards.
  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    function onScrollOrResize(e: Event) {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuOpen, closeMenu]);

  const handleMove = (direction: "left" | "right") => {
    setError(null);
    startTransition(async () => {
      const res = await movePipelineStageAction({}, { stageId: stage.id, direction });
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  const handleRenameSubmit = () => {
    const label = renameValue.trim();
    if (!label || label === stage.label) {
      setRenaming(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renamePipelineStageAction({}, { stageId: stage.id, label });
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const res = await archivePipelineStageAction({}, { stageId: stage.id });
      setConfirmArchive(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      closeMenu();
      onChanged();
    });
  };

  if (stage.isSystemStage) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/60"
        title="System stage — cannot be modified"
      >
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-md"
        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        title="Stage options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </Button>

      {menuOpen && menuPos
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed z-50 w-56 rounded-xl border border-border bg-card p-1.5 text-sm text-foreground shadow-elevated"
            >
              {error ? (
                <div className="mb-1.5">
                  <ErrorAlert message={error} />
                </div>
              ) : null}

              {renaming ? (
                <div className="flex flex-col gap-2 p-1.5">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSubmit();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    maxLength={60}
                    className="h-8 text-sm"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setRenaming(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isPending}
                      onClick={handleRenameSubmit}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <MenuItem
                    icon={Plus}
                    label="Add stage before"
                    onClick={() => {
                      closeMenu();
                      onAddBefore();
                    }}
                  />
                  <MenuItem
                    icon={Plus}
                    label="Add stage after"
                    onClick={() => {
                      closeMenu();
                      onAddAfter();
                    }}
                  />
                  <MenuItem icon={Pencil} label="Rename stage" onClick={() => setRenaming(true)} />
                  <MenuItem
                    icon={ChevronLeft}
                    label="Move left"
                    disabled={!stage.canMoveLeft || isPending}
                    onClick={() => handleMove("left")}
                  />
                  <MenuItem
                    icon={ChevronRight}
                    label="Move right"
                    disabled={!stage.canMoveRight || isPending}
                    onClick={() => handleMove("right")}
                  />
                  <div className="my-1 h-px bg-border" />
                  <MenuItem
                    icon={Archive}
                    label="Archive stage"
                    destructive
                    disabled={isPending}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmArchive(true);
                    }}
                  />
                </div>
              )}
            </div>,
            document.body
          )
        : null}

      <AlertDialog
        isOpen={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive stage"
        description={`Archive "${stage.label}"? It will be removed from the board, but any candidates currently in it stay exactly where they are and remain in reports/history. This cannot be undone from the board.`}
        actionLabel="Archive"
        isActionDestructive
        isPending={isPending}
        onAction={handleArchive}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}
