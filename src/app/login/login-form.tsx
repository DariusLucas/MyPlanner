"use client";

import { useState } from "react";
import { ArrowLeft, KeyRound, Mail, Plane } from "lucide-react";
import { useRouter } from "next/navigation";
import { initializeSignedInPlanner } from "./actions";
import { requestEmailOtp, verifyEmailOtp } from "@/src/lib/supabase/auth";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestEmailOtp(client, email);
      setStep("code");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sign-in code could not be sent.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await verifyEmailOtp(client, email, code);
      const initialized = await initializeSignedInPlanner();
      if (!initialized.ok) throw new Error(initialized.error);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That code could not be verified.");
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
          Sign in with the one-time code sent to your email.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">Email address</span>
              <span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <Mail size={16} className="text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                  placeholder="you@example.com"
                />
              </span>
            </label>
            <button disabled={pending} className="premium-primary-button w-full justify-center">
              {pending ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={13} /> Change email
            </button>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">Code sent to {email}</span>
              <span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <KeyRound size={16} className="text-muted-foreground" />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  minLength={6}
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="min-w-0 flex-1 bg-transparent py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none"
                  placeholder="000000"
                />
              </span>
            </label>
            <button disabled={pending} className="premium-primary-button w-full justify-center">
              {pending ? "Signing in…" : "Open planner"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
