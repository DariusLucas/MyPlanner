import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Cloud, KeyRound, LogOut, Mail, Plane, RefreshCw, RotateCcw, ShieldCheck, Wifi } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/src/components/app-shell";
import { DashboardView } from "@/src/components/dashboard-view";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { ProgressView } from "@/src/components/progress-view";
import { WeekView } from "@/src/components/week-view";
import { ConfirmationDialog } from "@/src/components/interaction-primitives";
import { ThemeToggle } from "@/src/components/theme-toggle";
import type { DashboardData } from "@/src/lib/dashboard";
import type { FocusAreaData } from "@/src/lib/focus-areas";
import type { ProgressData } from "@/src/lib/progress";
import { normalizeProgressCategory, normalizeProgressRange, progressRangeStart, type ProgressCategoryFilter, type ProgressRangeKey } from "@/src/lib/progress-visuals";
import type { WeekData } from "@/src/lib/week";
import { requestEmailOtp, verifyEmailOtp } from "@/src/lib/supabase/auth";
import { currentWeekStart, getDashboardData, getFocusAreaData, getProgressData, getWeekData } from "./data";
import { MobileAuthError, initializeMobilePlanner, mobileSupabase, signOutMobilePlanner } from "./supabase";
import { useMobileRouter } from "./router";

type Screen =
  | { kind: "dashboard"; data: DashboardData }
  | { kind: "focus"; data: FocusAreaData }
  | { kind: "week"; data: WeekData }
  | { kind: "progress"; data: ProgressData; range: ProgressRangeKey; category: ProgressCategoryFilter }
  | { kind: "settings" };
type LoadedScreen = { href: string; ownerId: string; value: Screen };
type SyncState = "connecting" | "live" | "disconnected";

function normalizeWeek(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeekStart();
  return value;
}

async function loadScreen(pathname: string, search: URLSearchParams): Promise<Screen> {
  if (pathname === "/" || pathname === "/today") return { kind: "dashboard", data: await getDashboardData() };
  if (pathname === "/week") return { kind: "week", data: await getWeekData(normalizeWeek(search.get("week"))) };
  if (pathname === "/career" || pathname === "/content") return { kind: "focus", data: await getFocusAreaData(pathname.slice(1) as "career" | "content") };
  if (pathname === "/progress") {
    const range = normalizeProgressRange(search.get("range") ?? undefined);
    const category = normalizeProgressCategory(search.get("category") ?? undefined);
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      kind: "progress", range, category,
      data: await getProgressData(progressRangeStart(range, today), category === "all" ? undefined : category),
    };
  }
  return { kind: "settings" };
}

function MobileLogin({ message }: { message?: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try { await requestEmailOtp(mobileSupabase, email); setStep("code"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The sign-in code could not be sent."); }
    finally { setPending(false); }
  }
  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    try { await verifyEmailOtp(mobileSupabase, email, code); await initializeMobilePlanner(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "That code could not be verified."); setPending(false); }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3"><span className="sidebar-plane grid size-11 place-items-center"><Plane size={30} strokeWidth={1.5} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Welcome back</h1></div></div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Sign in with the one-time code sent to your email. Android and web will use the same planner data.</p>
        {(error || message) && <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error ?? message}</div>}
        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <label className="block space-y-2"><span className="text-xs font-semibold text-muted-foreground">Email address</span><span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><Mail size={16} className="text-muted-foreground" /><input type="email" autoComplete="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="you@example.com" /></span></label>
            <button disabled={pending} className="premium-primary-button w-full justify-center">{pending ? "Sending…" : "Send sign-in code"}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(null); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Change email</button>
            <label className="block space-y-2"><span className="text-xs font-semibold text-muted-foreground">Code sent to {email}</span><span className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><KeyRound size={16} className="text-muted-foreground" /><input inputMode="numeric" autoComplete="one-time-code" required autoFocus minLength={6} maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="min-w-0 flex-1 bg-transparent py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none" placeholder="000000" /></span></label>
            <button disabled={pending} className="premium-primary-button w-full justify-center">{pending ? "Signing in…" : "Open planner"}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function Settings({ session, syncState }: { session: Session; syncState: SyncState }) {
  const [pending, setPending] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const details = [
    { icon: Cloud, title: "Shared planner data", text: "Android and web use the same ownership-protected Supabase planner." },
    { icon: ShieldCheck, title: "Secure session", text: "Your sign-in session is encrypted with the Android Keystore on this device." },
    { icon: Wifi, title: syncState === "live" ? "Live updates connected" : "Live updates reconnecting", text: "Remote planner changes refresh this app when a connection is available." },
    { icon: RefreshCw, title: "Network required", text: "Changes are saved to Supabase. Retry controls appear when the network is unavailable." },
  ];
  async function signOut() {
    setPending(true); setError(null);
    try { await signOutMobilePlanner(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); setPending(false); }
  }
  return (
    <section className="mx-auto w-full max-w-[1000px] space-y-6">
      <header><p className="dashboard-eyebrow">Your space</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.055em]">Settings</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Manage your account and mobile planner connection.</p></header>
      {error && <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
      <article className="settings-account-card">
        <div className="settings-account-avatar" aria-hidden="true"><Mail size={20} /></div>
        <div className="min-w-0 flex-1"><p className="settings-account-kicker">Planner account</p><p className="mt-1 truncate text-sm font-semibold">{session.user.email ?? "Your Planner account"}</p><p className="mt-1 text-xs text-muted-foreground">Signed in with an email one-time code</p></div>
        <button type="button" disabled={pending} onClick={() => setConfirmingSignOut(true)} className="settings-sign-out-button"><LogOut size={15} /> {pending ? "Signing out…" : "Sign out"}</button>
      </article>
      <article className="settings-preference-row"><div><h2 className="text-sm font-semibold">Appearance</h2><p className="mt-1 text-xs text-muted-foreground">Use a light, dark, or system-matched theme.</p></div><ThemeToggle /></article>
      <div className="grid gap-3 sm:grid-cols-2">{details.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-[22px] border border-border bg-card/80 p-5 shadow-sm"><span className="grid size-10 place-items-center rounded-[14px] bg-accent text-accent-foreground"><Icon size={18} /></span><h2 className="mt-4 text-sm font-semibold">{title}</h2><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p></article>)}</div>
      <ConfirmationDialog open={confirmingSignOut} title="Sign out?" description="Are you sure you want to sign out of this planner?" confirmLabel="Sign out" pending={pending} onCancel={() => setConfirmingSignOut(false)} onConfirm={() => void signOut()} />
    </section>
  );
}

function MobilePageSkeleton({ pathname, standalone = false }: { pathname: string; standalone?: boolean }) {
  const variant = pathname === "/week"
    ? "week"
    : pathname === "/progress"
      ? "progress"
      : pathname === "/settings"
        ? "settings"
        : "standard";
  const tileCount = variant === "progress" || variant === "settings" ? 4 : 3;
  const rowCount = variant === "week" ? 6 : 3;

  return (
    <section className={`mobile-page-skeleton ${standalone ? "mobile-page-skeleton-standalone" : ""}`} data-variant={variant} role="status" aria-label="Loading page" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <header className="mobile-skeleton-header" aria-hidden="true">
        <span className="mobile-skeleton-line mobile-skeleton-kicker" />
        <span className="mobile-skeleton-line mobile-skeleton-title" />
        <span className="mobile-skeleton-line mobile-skeleton-copy" />
      </header>
      <div className="mobile-skeleton-tiles" aria-hidden="true">
        {Array.from({ length: tileCount }, (_, index) => <span key={index} className="mobile-skeleton-tile" />)}
      </div>
      <div className="mobile-skeleton-panel" aria-hidden="true">
        <span className="mobile-skeleton-line mobile-skeleton-panel-title" />
        <div className="mobile-skeleton-rows">
          {Array.from({ length: rowCount }, (_, index) => <span key={index} className="mobile-skeleton-row" />)}
        </div>
      </div>
    </section>
  );
}

function RuntimeState({ error, retry }: { error: string; retry: () => void }) {
  return <div className="mobile-runtime-state"><div className="mobile-runtime-card"><h1 className="text-base font-semibold">Planner could not refresh</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p><button type="button" onClick={retry} className="premium-primary-button mt-5"><RotateCcw size={15} /> Try again</button></div></div>;
}

function renderScreen(screen: Screen, session: Session, syncState: SyncState): ReactNode {
  if (screen.kind === "dashboard") return <DashboardView data={screen.data} />;
  if (screen.kind === "focus") return <FocusAreaView data={screen.data} />;
  if (screen.kind === "week") return <WeekView data={screen.data} />;
  if (screen.kind === "progress") return <ProgressView data={screen.data} range={screen.range} category={screen.category} />;
  return <Settings session={session} syncState={syncState} />;
}

export function MobileApp() {
  const route = useMobileRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [screen, setScreen] = useState<LoadedScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    mobileSupabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = mobileSupabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) setAuthMessage(null);
      setSession(nextSession);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    App.getState().then(({ isActive }) => {
      if (isActive) mobileSupabase.auth.startAutoRefresh();
      else mobileSupabase.auth.stopAutoRefresh();
    });
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) mobileSupabase.auth.startAutoRefresh();
      else mobileSupabase.auth.stopAutoRefresh();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else removeListener = () => handle.remove();
    });
    return () => { disposed = true; void removeListener?.(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const channel = mobileSupabase.channel(`planner-mobile-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public" }, () => setRemoteRevision((value) => value + 1))
      .subscribe((status) => setSyncState(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "disconnected" : "connecting"));
    return () => { void mobileSupabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!session) { setScreen(null); setError(null); return; }
    let active = true; setError(null);
    const requestedHref = route.href;
    const ownerId = session.user.id;
    loadScreen(route.pathname, route.searchParams)
      .then((next) => { if (active) setScreen({ href: requestedHref, ownerId, value: next }); })
      .catch((reason: unknown) => {
        console.error(reason);
        if (!active) return;
        if (reason instanceof MobileAuthError) {
          setAuthMessage("Your session expired. Sign in again to continue.");
          setSession(null);
          return;
        }
        setError(!navigator.onLine ? "You appear to be offline. Reconnect and try again." : reason instanceof Error ? reason.message : "Planner data could not be loaded.");
      });
    return () => { active = false; };
  }, [session, route.pathname, route.href, route.searchParams, route.revision, retry, remoteRevision]);

  if (session === undefined) return <MobilePageSkeleton pathname={route.pathname} standalone />;
  if (!session) return <MobileLogin message={authMessage} />;
  const visibleScreen = screen?.href === route.href && screen.ownerId === session.user.id ? screen.value : null;
  return <AppShell userEmail={session.user.email} signOutAction={signOutMobilePlanner}>{error ? <RuntimeState error={error} retry={() => setRetry((value) => value + 1)} /> : visibleScreen ? renderScreen(visibleScreen, session, syncState) : <MobilePageSkeleton pathname={route.pathname} />}</AppShell>;
}
