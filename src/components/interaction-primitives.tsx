"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Check } from "lucide-react";
import { createPortal } from "react-dom";
import { completionLabel } from "@/src/lib/interaction";

const focusableSelector = [
  "[autofocus]",
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogContract<T extends HTMLElement = HTMLElement>({
  active = true,
  blocked = false,
  lockScroll = true,
  onClose,
}: {
  active?: boolean;
  blocked?: boolean;
  lockScroll?: boolean;
  onClose: () => void;
}): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  const blockedRef = useRef(blocked);
  const closeRef = useRef(onClose);

  blockedRef.current = blocked;
  closeRef.current = onClose;
  if (active && !wasActiveRef.current && typeof document !== "undefined") {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }
  wasActiveRef.current = active;

  useEffect(() => {
    if (!active) return;
    const currentDialog = () => dialogRef.current ?? [...document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']")].at(-1) ?? null;
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = currentDialog();
      const preferred = dialog?.querySelector<HTMLElement>("[autofocus]");
      const first = preferred ?? dialog?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialog)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = currentDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        if (!blockedRef.current) {
          event.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      window.requestAnimationFrame(() => opener?.isConnected && opener.focus());
    };
  }, [active, lockScroll]);

  return dialogRef;
}

export function TaskCompletionButton({
  title,
  completed,
  pending = false,
  pendingContent,
  animating = false,
  incompleteContent,
  className = "",
  type = "button",
  ...props
}: {
  title: string;
  completed: boolean;
  pending?: boolean;
  pendingContent?: ReactNode;
  animating?: boolean;
  incompleteContent?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      {...props}
      type={type}
      disabled={pending || props.disabled}
      aria-label={completionLabel(title, completed)}
      aria-busy={pending || undefined}
      className={`task-check ${completed ? "task-check-completed" : ""} ${animating ? "completion-check-bloom task-check-animate-complete" : ""} ${className}`.trim()}
    >
      <span className="task-check-surface">
        {completed || animating ? <Check size={12} strokeWidth={3} /> : pending ? pendingContent !== undefined ? pendingContent : <span className="task-check-pending" /> : incompleteContent}
      </span>
    </button>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useDialogContract<HTMLElement>({ active: open, blocked: pending, onClose: onCancel });
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !pending && onCancel()}>
      <section ref={dialogRef} tabIndex={-1} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-confirm-title" aria-describedby="shared-confirm-description">
        <p className="confirm-dialog-kicker">Please confirm</p>
        <h2 id="shared-confirm-title" className="mt-1 text-lg font-semibold">{title}</h2>
        <p id="shared-confirm-description" className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {pending && <p role="status" className="task-save-status">Working…</p>}
        <div className="dialog-actions mt-6 flex justify-end gap-2">
          <button type="button" autoFocus disabled={pending} onClick={onCancel} className="thought-quiet-button">Cancel</button>
          <button type="button" disabled={pending} onClick={onConfirm} className="premium-small-button">{pending ? "Working…" : confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
