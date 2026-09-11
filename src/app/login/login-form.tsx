"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, Plane } from "lucide-react";
import { useRouter } from "next/navigation";
import { initializeSignedInPlanner } from "./actions";
import {
  minimumPasswordLength,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
} from "@/src/lib/supabase/auth";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.62.39 3.15 1.04 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "sign-up") {
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const result = await signUpWithEmailPassword(client, email, password, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (!result.session) {
          setMessage("Check your email to confirm your account, then sign in with your password.");
          return;
        }
      } else {
        await signInWithEmailPassword(client, email, password);
      }
      const initialized = await initializeSignedInPlanner();
      if (!initialized.ok) throw new Error(initialized.error);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your account could not be opened.");
    } finally {
      setPending(false);
    }
  }

  async function continueWithGoogle() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await signInWithGoogle(client, `${window.location.origin}/auth/callback`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="sidebar-plane grid size-11 place-items-center" aria-hidden="true">
            <Plane size={30} strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Welcome back</h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          {mode === "sign-in" ? "Sign in to continue to your planner." : "Create a private planner account."}
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => void continueWithGoogle()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleMark /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submitCredentials} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Email address</span>
            <span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
              <Mail size={16} className="text-muted-foreground" />
              <input type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="you@example.com" />
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">Password</span>
            <span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
              <KeyRound size={16} className="text-muted-foreground" />
              <input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required minLength={mode === "sign-up" ? minimumPasswordLength : undefined} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder={mode === "sign-up" ? `At least ${minimumPasswordLength} characters` : "Your password"} />
            </span>
          </label>
          {mode === "sign-up" && (
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">Confirm password</span>
              <span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <KeyRound size={16} className="text-muted-foreground" />
                <input type="password" autoComplete="new-password" required minLength={minimumPasswordLength} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Repeat your password" />
              </span>
            </label>
          )}
          <button disabled={pending} className="premium-primary-button w-full justify-center">
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-3 text-xs font-semibold">
          {mode === "sign-in" && <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot or need to create a password?</Link>}
          <button type="button" disabled={pending} onClick={() => { setMode((value) => value === "sign-in" ? "sign-up" : "sign-in"); setPassword(""); setConfirmPassword(""); setError(null); setMessage(null); }} className="text-[var(--orange)] hover:underline">
            {mode === "sign-in" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
