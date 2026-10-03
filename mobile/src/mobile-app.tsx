import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { ArrowLeft, LogOut, Mail, Plane, RotateCcw, Trash2 } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { format } from "date-fns";
import { AppShell } from "@/src/components/app-shell";
import { CategoryProvider } from "@/src/components/category-context";
import { DashboardView } from "@/src/components/dashboard-view";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { ProgressView } from "@/src/components/progress-view";
import { WeekView } from "@/src/components/week-view";
import { ConfirmationDialog } from "@/src/components/interaction-primitives";
import { ThemeToggle } from "@/src/components/theme-toggle";
import { PrivacyPolicyContent } from "@/src/components/privacy-policy-content";
import type { DashboardData } from "@/src/lib/dashboard";
import type { FocusAreaData } from "@/src/lib/focus-areas";
import type { ProgressData } from "@/src/lib/progress";
import { normalizeProgressCategories, normalizeProgressRange, progressRangeStart, type ProgressRangeKey } from "@/src/lib/progress-visuals";
import type { PlannerCategory } from "@/src/lib/categories";
import type { WeekData } from "@/src/lib/week";
import { currentWeekStart, getDashboardData, getFocusAreaData, getPlannerCategories, getProgressData, getWeekData } from "./data";
import { closeMobileAuthBrowser, deleteMobilePlannerAccount, handleMobileAuthUrl, initializeMobilePlanner, MobileAuthError, mobileSupabase, openMobileGoogleSignIn, signOutMobilePlanner } from "./supabase";
import { useMobileRouter } from "./router";

type Screen =
  | { kind: "dashboard"; data: DashboardData }
  | { kind: "focus"; data: FocusAreaData }
  | { kind: "week"; data: WeekData }
  | { kind: "progress"; data: ProgressData; range: ProgressRangeKey; categories: string[] }
  | { kind: "settings" };
type LoadedScreen = { href: string; ownerId: string; value: Screen };
const candidateSiteUrl = import.meta.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
const publicSiteUrl = candidateSiteUrl.startsWith("https://") && !candidateSiteUrl.includes("replace-with-")
  ? candidateSiteUrl
  : null;
const candidatePublisher = import.meta.env.NEXT_PUBLIC_PUBLISHER_NAME?.trim();
const policyPublisher = candidatePublisher && !candidatePublisher.toLowerCase().startsWith("replace-with-") && candidatePublisher !== "Your publisher name"
  ? candidatePublisher
  : undefined;
const candidateSupportEmail = import.meta.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const policySupportEmail = candidateSupportEmail && !candidateSupportEmail.toLowerCase().startsWith("replace-with-") && candidateSupportEmail !== "support@example.com"
  ? candidateSupportEmail
  : undefined;

function normalizeWeek(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeekStart();
  return value;
}

async function loadScreen(pathname: string, search: URLSearchParams): Promise<Screen> {
  if (pathname === "/" || pathname === "/today") return { kind: "dashboard", data: await getDashboardData() };
  if (pathname === "/week") return { kind: "week", data: await getWeekData(normalizeWeek(search.get("week"))) };
  if (pathname.startsWith("/category/")) return { kind: "focus", data: await getFocusAreaData(pathname.slice("/category/".length)) };
  if (pathname === "/progress") {
    const range = normalizeProgressRange(search.get("range") ?? undefined);
    const categories = normalizeProgressCategories(search.get("categories") ?? search.get("category") ?? undefined);
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      kind: "progress", range, categories,
      data: await getProgressData(progressRangeStart(range, today), categories),
    };
  }
  return { kind: "settings" };
}

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

function MobileLogin({ message: initialMessage }: { message?: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);

  async function continueWithGoogle() {
    setPending(true); setError(null); setMessage(null);
    try { await openMobileGoogleSignIn(); setPending(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in could not be started."); setPending(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="glass-panel w-full max-w-md rounded-[30px] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3"><span className="sidebar-plane grid size-11 place-items-center"><Plane size={30} strokeWidth={1.5} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">My Planner</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">Welcome back</h1></div></div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">Sign in to the same planner on Android and web.</p>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
        {message && <div role="status" className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">{message}</div>}
        <button type="button" disabled={pending} onClick={() => void continueWithGoogle()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"><GoogleMark /> {pending ? "Opening Google…" : "Continue with Google"}</button>
        {publicSiteUrl && <p className="mt-5 text-center text-xs text-muted-foreground"><button type="button" className="underline" onClick={() => void Browser.open({ url: `${publicSiteUrl}/privacy` })}>Privacy Policy</button></p>}
      </section>
    </main>
  );
}

function Settings({ session }: { session: Session }) {
  const [pending, setPending] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    setPending(true); setError(null);
    try { await signOutMobilePlanner(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign out failed."); setPending(false); }
  }
  async function deleteAccount() {
    setPending(true); setError(null);
    try { await deleteMobilePlannerAccount(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Account deletion failed."); setPending(false); }
  }
  if (showPrivacyPolicy) {
    return (
      <section className="mobile-privacy-page mx-auto w-full max-w-[760px] space-y-4">
        <button type="button" className="settings-sign-out-button" onClick={() => setShowPrivacyPolicy(false)}><ArrowLeft size={15} /> Back to profile</button>
        <PrivacyPolicyContent publisher={policyPublisher} supportEmail={policySupportEmail} showWebDeletionLink={false} />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1000px] space-y-6">
      <header><h1 className="text-3xl font-semibold tracking-[-.055em]">Profile</h1></header>
      {error && <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}</div>}
      <article className="settings-account-card">
        <div className="settings-account-avatar" aria-hidden="true"><Mail size={20} /></div>
        <div className="min-w-0 flex-1"><p className="settings-account-kicker">Planner account</p><p className="mt-1 truncate text-sm font-semibold">{session.user.email ?? "Your Planner account"}</p><p className="mt-1 text-xs text-muted-foreground">Google account</p></div>
        <button type="button" disabled={pending} onClick={() => setConfirmingSignOut(true)} className="settings-sign-out-button"><LogOut size={15} /> {pending ? "Signing out…" : "Sign out"}</button>
      </article>
      <article className="settings-preference-row"><div><h2 className="text-sm font-semibold">Appearance</h2></div><ThemeToggle labelled /></article>
      <article className="settings-preference-row"><div><h2 className="text-sm font-semibold">Privacy</h2></div><button type="button" className="settings-sign-out-button" onClick={() => setShowPrivacyPolicy(true)}>Privacy policy</button></article>
      <article className="settings-danger-zone"><div><h2 className="text-sm font-semibold">Delete account and planner data</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Permanently delete this account, tasks, categories, milestones, thoughts, and progress history.</p></div><button type="button" className="settings-delete-account-button" disabled={pending} onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Delete account</button></article>
      <ConfirmationDialog open={confirmingSignOut} title="Sign out?" description="Are you sure you want to sign out of this planner?" confirmLabel="Sign out" pending={pending} onCancel={() => setConfirmingSignOut(false)} onConfirm={() => void signOut()} />
      <ConfirmationDialog open={confirmingDelete} title="Delete your account and planner data?" description="This permanently removes your account, tasks, categories, milestones, thoughts, and progress history. This action cannot be undone." confirmLabel="Delete everything" pending={pending} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void deleteAccount()} />
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

function renderScreen(screen: Screen, session: Session, categories: PlannerCategory[]): ReactNode {
  if (screen.kind === "dashboard") return <DashboardView data={screen.data} />;
  if (screen.kind === "focus") return <FocusAreaView data={screen.data} />;
  if (screen.kind === "week") return <WeekView data={screen.data} />;
  if (screen.kind === "progress") return <ProgressView data={screen.data} range={screen.range} selectedCategories={screen.categories} categories={categories} />;
  return <Settings session={session} />;
}

export function MobileApp() {
  const route = useMobileRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [screen, setScreen] = useState<LoadedScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [remoteRevision, setRemoteRevision] = useState(0);
  const [categories, setCategories] = useState<PlannerCategory[]>([]);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const consumeAuthUrl = async (url: string) => {
      try {
        const result = await handleMobileAuthUrl(url);
        if (result) await closeMobileAuthBrowser();
      } catch (cause) {
        if (active) setAuthMessage(cause instanceof Error ? cause.message : "The sign-in link could not be used.");
      }
    };
    App.getLaunchUrl().then((launch) => {
      if (launch?.url) void consumeAuthUrl(launch.url);
    });
    const urlListener = App.addListener("appUrlOpen", ({ url }) => void consumeAuthUrl(url));
    mobileSupabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = mobileSupabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession) setAuthMessage(null);
      setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      void urlListener.then((handle) => handle.remove());
    };
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
      .subscribe();
    return () => { void mobileSupabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!session) { setScreen(null); setError(null); return; }
    let active = true; setError(null);
    const requestedHref = route.href;
    const ownerId = session.user.id;
    initializeMobilePlanner()
      .then(() => Promise.all([loadScreen(route.pathname, route.searchParams), getPlannerCategories()]))
      .then(([next, nextCategories]) => { if (active) { setCategories(nextCategories); setScreen({ href: requestedHref, ownerId, value: next }); } })
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
  return <CategoryProvider categories={categories}><AppShell userEmail={session.user.email} signOutAction={signOutMobilePlanner}>{error ? <RuntimeState error={error} retry={() => setRetry((value) => value + 1)} /> : visibleScreen ? renderScreen(visibleScreen, session, categories) : <MobilePageSkeleton pathname={route.pathname} />}</AppShell></CategoryProvider>;
}
