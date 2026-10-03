"use client";

import { useState } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { signInWithGoogle } from "@/src/lib/supabase/auth";
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

export function LoginForm({ initialError, initialMessage, next = "/" }: { initialError?: string; initialMessage?: string; next?: string }) {
  const [client] = useState(createSupabaseBrowserClient);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function continueWithGoogle() {
    setPending(true);
    setError(null);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      if (next !== "/") callback.searchParams.set("next", next);
      await signInWithGoogle(client, callback.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="sidebar-plane grid size-11 place-items-center" aria-hidden="true"><Plane size={30} strokeWidth={1.5} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Welcome back</h1>
          </div>
        </div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Sign in to continue to your planner.</p>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
        {initialMessage && <div role="status" className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">{initialMessage}</div>}
        <button
          type="button"
          disabled={pending}
          onClick={() => void continueWithGoogle()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleMark /> {pending ? "Opening Google…" : "Continue with Google"}
        </button>
        <p className="mt-5 text-center text-xs text-muted-foreground"><Link className="underline" href="/privacy">Privacy Policy</Link></p>
      </section>
    </main>
  );
}
