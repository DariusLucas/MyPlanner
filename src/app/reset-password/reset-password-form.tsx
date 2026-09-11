"use client";

import { KeyRound, Plane } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";
import { minimumPasswordLength, updatePassword } from "@/src/lib/supabase/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (password !== confirmation) throw new Error("The passwords do not match.");
      await updatePassword(client, password);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your password could not be updated.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3"><span className="sidebar-plane grid size-11 place-items-center" aria-hidden="true"><Plane size={30} strokeWidth={1.5} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Choose a password</h1></div></div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">This password will work on both web and Android.</p>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block space-y-2"><span className="text-xs font-semibold text-muted-foreground">New password</span><span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><KeyRound size={16} className="text-muted-foreground" /><input type="password" autoComplete="new-password" required autoFocus minLength={minimumPasswordLength} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder={`At least ${minimumPasswordLength} characters`} /></span></label>
          <label className="block space-y-2"><span className="text-xs font-semibold text-muted-foreground">Confirm password</span><span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><KeyRound size={16} className="text-muted-foreground" /><input type="password" autoComplete="new-password" required minLength={minimumPasswordLength} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Repeat your password" /></span></label>
          <button disabled={pending} className="premium-primary-button w-full justify-center">{pending ? "Saving…" : "Save password"}</button>
        </form>
      </section>
    </main>
  );
}
