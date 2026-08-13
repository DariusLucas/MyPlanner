import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight, Circle, Plus } from "lucide-react";
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

      <section className="glass-panel overflow-hidden rounded-[28px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><CalendarDays size={18} /></span><div><p className="text-base font-semibold tracking-[-0.025em]">Today</p><p className="text-xs text-muted-foreground">{today.total === 0 ? "Nothing planned yet" : `${today.completed} of ${today.total} actions complete`}</p></div></div>
            <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-accent-foreground hover:underline">Open checklist <ArrowRight size={15} /></Link>
          </div>
          <div className="p-3 sm:p-4">
            {visibleTasks.length > 0 ? <div className="space-y-1">{visibleTasks.map((task) => <DashboardTask key={task.id} task={task} />)}</div> : <EmptyToday />}
            {today.tasks.length > visibleTasks.length && <Link href="/today" className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-muted/60 px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">See all {today.tasks.length} tasks <ChevronRight size={14} /></Link>}
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
