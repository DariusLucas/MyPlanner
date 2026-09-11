"use client";

import Link from "next/link";
import { ArrowLeft, Mail, Plane } from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";
import { requestPasswordReset } from "@/src/lib/supabase/auth";

export function ForgotPasswordForm() {
  const [client] = useState(createSupabaseBrowserClient);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(client, email, `${window.location.origin}/auth/callback?next=/reset-password`);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The password email could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="sidebar-plane grid size-11 place-items-center" aria-hidden="true"><Plane size={30} strokeWidth={1.5} /></span>
          <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Set a password</h1></div>
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Use this if you forgot your password or previously signed in with an email code. Your existing planner data stays with the same account.</p>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
        {sent ? (
          <div className="mt-6 space-y-4">
            <div role="status" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">If an account exists for that email, a secure password link is on its way.</div>
            <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={13} /> Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block space-y-2"><span className="text-xs font-semibold text-muted-foreground">Email address</span><span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><Mail size={16} className="text-muted-foreground" /><input type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="you@example.com" /></span></label>
            <button disabled={pending} className="premium-primary-button w-full justify-center">{pending ? "Sending…" : "Email me a password link"}</button>
            <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={13} /> Back to sign in</Link>
          </form>
        )}
      </section>
    </main>
  );
}
