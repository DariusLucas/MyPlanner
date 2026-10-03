"use client";

import { useState, useTransition } from "react";
import { deleteCurrentAccount } from "@/src/app/account-actions";
import { ConfirmationDialog } from "./interaction-primitives";

export function DeleteAccountControl() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCurrentAccount();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-muted-foreground">Permanently delete your account and all planner data. This cannot be undone.</p>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="button" className="settings-delete-account-button" disabled={pending} onClick={() => setOpen(true)}>
        Delete account
      </button>
      <ConfirmationDialog
        open={open}
        title="Delete your account and planner data?"
        description="This permanently removes your account, tasks, categories, milestones, thoughts, and progress history. This action cannot be undone."
        confirmLabel="Delete everything"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </div>
  );
}
