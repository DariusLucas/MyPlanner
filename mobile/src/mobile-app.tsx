import { useEffect, useState, type ReactNode } from "react";
import { Database, HardDrive, RotateCcw, ShieldCheck, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/src/components/app-shell";
import { DashboardView } from "@/src/components/dashboard-view";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { ProgressView } from "@/src/components/progress-view";
import { WeekView } from "@/src/components/week-view";
import type { DashboardData } from "@/src/lib/dashboard";
import type { FocusAreaData } from "@/src/lib/focus-areas";
import type { ProgressData } from "@/src/lib/progress";
import {
  normalizeProgressCategory,
  normalizeProgressRange,
  progressRangeStart,
  type ProgressCategoryFilter,
  type ProgressRangeKey,
} from "@/src/lib/progress-visuals";
import type { WeekData } from "@/src/lib/week";
import { initializeDatabase } from "./database";
import {
  currentWeekStart,
  getDashboardData,
  getFocusAreaData,
  getProgressData,
  getWeekData,
} from "./data";
import { useMobileRouter } from "./router";

type Screen =
  | { kind: "dashboard"; data: DashboardData }
  | { kind: "focus"; data: FocusAreaData }
  | { kind: "week"; data: WeekData }
  | { kind: "progress"; data: ProgressData; range: ProgressRangeKey; category: ProgressCategoryFilter }
  | { kind: "settings" };

function normalizeWeek(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeekStart();
  return value;
}

async function loadScreen(pathname: string, search: URLSearchParams): Promise<Screen> {
  await initializeDatabase();
  if (pathname === "/") return { kind: "dashboard", data: await getDashboardData() as DashboardData };
  if (pathname === "/week" || pathname === "/today") {
    return { kind: "week", data: await getWeekData(normalizeWeek(search.get("week"))) as WeekData };
  }
  if (pathname === "/career" || pathname === "/content") {
    return { kind: "focus", data: await getFocusAreaData(pathname.slice(1) as "career" | "content") as FocusAreaData };
  }
  if (pathname === "/progress") {
    const range = normalizeProgressRange(search.get("range") ?? undefined);
    const category = normalizeProgressCategory(search.get("category") ?? undefined);
    const today = format(new Date(), "yyyy-MM-dd");
    return {
      kind: "progress",
      range,
      category,
      data: await getProgressData(
        progressRangeStart(range, today),
        category === "all" ? undefined : category,
      ) as ProgressData,
    };
  }
  return { kind: "settings" };
}

function Settings() {
  const details = [
    { icon: WifiOff, title: "Works offline", text: "Planning, task completion, Kanban, milestones, and progress do not need an internet connection." },
    { icon: Database, title: "On-device SQLite", text: "Your mobile planner is stored privately inside this Android app." },
    { icon: ShieldCheck, title: "No remote account", text: "This build does not upload planner data or depend on your computer." },
    { icon: HardDrive, title: "Separate mobile data", text: "The phone database is independent from the desktop database until backup transfer or sync is added." },
  ];
  return (
    <section className="mx-auto w-full max-w-[1000px] space-y-6">
      <header>
        <p className="dashboard-eyebrow">Android runtime</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.055em]">Mobile settings</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          This standalone installation keeps the Plan → Do → Complete → See Progress loop available wherever you are.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {details.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-[22px] border border-border bg-card/80 p-5 shadow-sm">
            <span className="grid size-10 place-items-center rounded-[14px] bg-accent text-accent-foreground"><Icon size={18} /></span>
            <h2 className="mt-4 text-sm font-semibold">{title}</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RuntimeState({ error, retry }: { error?: string; retry?: () => void }) {
  return (
    <div className="mobile-runtime-state">
      <div className="mobile-runtime-card">
        {error ? (
          <>
            <h1 className="text-base font-semibold">Planner could not open</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
            <button type="button" onClick={retry} className="premium-primary-button mt-5"><RotateCcw size={15} /> Try again</button>
          </>
        ) : (
          <>
            <div className="mobile-runtime-spinner" />
            <p className="text-sm font-medium">Opening your planner…</p>
          </>
        )}
      </div>
    </div>
  );
}

function renderScreen(screen: Screen): ReactNode {
  if (screen.kind === "dashboard") return <DashboardView data={screen.data} />;
  if (screen.kind === "focus") return <FocusAreaView data={screen.data} />;
  if (screen.kind === "week") return <WeekView data={screen.data} />;
  if (screen.kind === "progress") return <ProgressView data={screen.data} range={screen.range} category={screen.category} />;
  return <Settings />;
}

export function MobileApp() {
  const route = useMobileRouter();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    loadScreen(route.pathname, route.searchParams)
      .then((next) => { if (active) setScreen(next); })
      .catch((reason: unknown) => {
        console.error(reason);
        if (active) setError(reason instanceof Error ? reason.message : "The on-device database could not be opened.");
      });
    return () => { active = false; };
  }, [route.pathname, route.href, route.searchParams, route.revision, retry]);

  return (
    <AppShell>
      {error ? <RuntimeState error={error} retry={() => setRetry((value) => value + 1)} /> : screen ? renderScreen(screen) : <RuntimeState />}
    </AppShell>
  );
}
