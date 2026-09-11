"use client";

import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmationDialog } from "./interaction-primitives";

export function SettingsAccountCard({ email, signOutAction }: { email: string; signOutAction: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <>
      <article className="settings-account-card">
        <div className="settings-account-avatar" aria-hidden="true"><UserRound size={22} /></div>
        <div className="min-w-0 flex-1">
          <p className="settings-account-kicker">Planner account</p>
          <p className="mt-1 truncate text-sm font-semibold">{email}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> Signed in</span>
            <span className="inline-flex items-center gap-1.5"><Mail size={14} /> Email/password or Google</span>
          </div>
        </div>
        <button type="button" disabled={pending} onClick={() => setConfirming(true)} className="settings-sign-out-button"><LogOut size={15} /> {pending ? "Signing out…" : "Sign out"}</button>
      </article>
      <ConfirmationDialog
        open={confirming}
        title="Sign out?"
        description="Are you sure you want to sign out of this planner?"
        confirmLabel="Sign out"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={signOut}
      />
    </>
  );
}
