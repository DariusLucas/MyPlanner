import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Circle, Clapperboard, Flame, Goal, LockKeyhole, Plus, Sparkles, Target } from "lucide-react";
import { format, parseISO } from "date-fns";
import { currentDateValue, getTodayData, type TaskCategory, type TodayTask } from "@/src/lib/today";

export const dynamic = "force-dynamic";

const categoryLabels: Record<TaskCategory, string> = { career: "Career", content: "Content", other: "Other" };

export default function DashboardPage() {
  const date = currentDateValue();
  const today = getTodayData(date);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const visibleTasks = today.tasks.slice(0, 6);

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm cusnt-medium text-muted-foreground">{greeting} · {format(parseISO(date), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">What matters today?</h1>
        </div>
        <Link href="/today" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--orange)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(190,82,37,0.22)] transition hover:brightness-95"><Plus size={16} /> Add task</Link>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="glass-panel overflow-hidden rounded-[28px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><CalendarDays size={18} /></span><div><p className="text-base font-semibold tracking-[-0.025em]">Today</p><p className="text-xs text-muted-foreground">{today.total === 0 ? "Nothing planned yet" : `${today.completed} of ${today.total} actions complete`}</p></div></div>
            <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-accent-foreground hover:underline">Open checklist <ArrowRight size={15} /></Link>
          </div>
          <div className="p-3 sm:p-4">
            {visibleTasks.length > 0 ? <div className="space-y-1">{visibleTasks.map((task) => <DashboardTask key={task.id} task={task} />)}</div> : <EmptyToday />}
            {today.tasks.length > visibleTasks.length && <Link href="/today" className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-muted/60 px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">See all {today.tasks.length} tasks <ChevronRight size={14} /></Link>}
          </div>
        </div>

        <aside className="glass-panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Daily focus</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Your direction</h2></div><Sparkles size={18} className="text-[var(--orange)]" /></div>
          <Mission label="Career" value={today.focus?.careerMission} fallback="Set the one career outcome that would make today count." icon={BriefcaseBusiness} />
          <Mission label="Content" value={today.focus?.contentMission} fallback="Set the one creative output you want to move forward." icon={Clapperboard} />
          <Link href="/today" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground hover:underline">Edit today’s focus <ArrowRight size={13} /></Link>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SprintCard />
        <section className="glass-panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">This week</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Outputs to protect</h2></div><Flame size={18} className="text-[var(--orange)]" /></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <FutureMetric label="Deep work sessions" target="5" phase="Plan" />
            <FutureMetric label="Job applications" target="12" phase="Career" />
            <FutureMetric label="Videos published" target="3" phase="Content" />
            <FutureMetric label="Camera videos" target="1" phase="Content" />
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Weekly targets will appear here once Planning, Career, and Content are connected.</p>
        </section>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Your workspace</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Build the system around action.</h2></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FutureModule icon={Goal} title="Goals & sprints" phase="Phase 3" description="Connect daily actions to a five-week plan." />
          <FutureModule icon={BriefcaseBusiness} title="Career rhythm" phase="Phase 4" description="Applications, outreach, learning, and project work." />
          <FutureModule icon={Clapperboard} title="Content pipeline" phase="Phase 5" description="Move ideas cleanly from hook to published." />
          <FutureModule icon={Target} title="Progress evidence" phase="Phase 6" description="See consistency, outputs, and milestones over time." />
        </div>
      </section>
    </div>
  );
}

function DashboardTask({ task }: { task: TodayTask }) {
  const complete = task.status === "completed";
  return <Link href="/today" className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-muted/55"><span className={`grid size-5 shrink-0 place-items-center rounded-full border ${complete ? "border-[var(--orange)] bg-[var(--orange)] text-white" : "border-muted-foreground/45"}`}>{complete && <Check size={12} strokeWidth={3} />}</span><div className="min-w-0 flex-1"><p className={`truncate text-sm ${complete ? "text-muted-foreground line-through" : "font-medium"}`}>{task.title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{categoryLabels[task.category]}{task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ""}</p></div><ChevronRight size={15} className="text-muted-foreground/70" /></Link>;
}

function EmptyToday() {
  return <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground"><Circle size={18} /></span><p className="mt-3 font-medium">Nothing planned for today.</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Add one clear action and give your day a starting point.</p><Link href="/today" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground hover:underline">Plan today <ArrowRight size={14} /></Link></div>;
}

function Mission({ label, value, fallback, icon: Icon }: { label: string; value?: string | null; fallback: string; icon: typeof BriefcaseBusiness }) {
  return <div className="mt-5 rounded-2xl border border-border bg-background/35 p-3.5"><div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground"><Icon size={14} /> {label}</div><p className={`mt-2 text-sm leading-5 ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || fallback}</p></div>;
}

function SprintCard() {
  return <section className="glass-panel relative overflow-hidden rounded-[28px] p-5 sm:p-6"><div className="absolute -right-9 -top-8 size-32 rounded-full bg-[var(--orange-soft)] opacity-55" /><div className="relative flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">5-week sprint</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Your plan is taking shape.</h2></div><span className="grid size-10 place-items-center rounded-xl border border-border bg-card/70 text-accent-foreground"><LockKeyhole size={17} /></span></div><p className="relative mt-2 max-w-md text-sm leading-6 text-muted-foreground">Sprint weeks, outcomes, and live progress will connect to your tasks in Phase 3.</p><div className="relative mt-5 flex gap-1.5">{[1, 2, 3, 4, 5].map((week) => <span key={week} className="flex-1 rounded-full bg-muted px-1 py-1"><span className="block h-1.5 rounded-full bg-border" /></span>)}</div><div className="relative mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Week 1</span><span>Week 5</span></div></section>;
}

function FutureMetric({ label, target, phase }: { label: string; target: string; phase: string }) {
  return <div className="rounded-2xl border border-border bg-background/35 p-3.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{label}</p><LockKeyhole size={13} className="text-muted-foreground" /></div><p className="mt-2 text-base font-semibold tracking-[-0.03em]"><span className="text-muted-foreground">—</span> <span className="text-xs font-normal text-muted-foreground">/ {target}</span></p><p className="mt-1 text-[11px] text-accent-foreground">{phase} phase</p></div>;
}

function FutureModule({ icon: Icon, title, phase, description }: { icon: typeof Goal; title: string; phase: string; description: string }) {
  return <section className="glass-panel rounded-[22px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(69,57,41,0.11)]"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon size={17} /></span><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"><LockKeyhole size={10} /> {phase}</span></div><h3 className="mt-4 text-sm font-semibold tracking-[-0.02em]">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></section>;
}
