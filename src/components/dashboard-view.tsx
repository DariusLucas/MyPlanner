"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock3, Flame, Lightbulb, LoaderCircle, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { createThought, deleteThought, updateThought } from "@/src/app/dashboard-actions";
import { createTask, deleteTask, toggleTask, updateTask, type ActionResult } from "@/src/app/today/actions";
import type { DashboardData, QuickThought } from "@/src/lib/dashboard";
import type { PlannerId, TaskCategory, TodayTask } from "@/src/lib/today";
import { TaskComposer } from "@/src/components/week-view";
import { TaskCompletionButton, useDialogContract } from "@/src/components/interaction-primitives";
import { COMPLETION_FEEDBACK_MS, COMPLETION_UNDO_MS, DIALOG_EXIT_MS } from "@/src/lib/interaction";

const categoryLabels: Record<TaskCategory, string> = { career: "Career", content: "Content", other: "Personal" };
const taskCategories = Object.keys(categoryLabels) as TaskCategory[];
type UndoItem = { id: PlannerId; title: string; revision: number };
type DeferredTask = { task: TodayTask; overdue: boolean; index: number };

export function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<PlannerId>>(() => new Set());
  const [finishingIds, setFinishingIds] = useState<Set<PlannerId>>(() => new Set());
  const [undoingIds, setUndoingIds] = useState<Set<PlannerId>>(() => new Set());
  const [restoringIds, setRestoringIds] = useState<Set<PlannerId>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [undoItems, setUndoItems] = useState<UndoItem[]>([]);
  const [deferredTasks, setDeferredTasks] = useState<Map<PlannerId, DeferredTask>>(() => new Map());
  const [composer, setComposer] = useState(false);
  const [composerPending, setComposerPending] = useState(false);
  const [editingTask, setEditingTask] = useState<TodayTask | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [selectedCompletionDate, setSelectedCompletionDate] = useState(data.date);
  const undoTimers = useRef<Map<PlannerId, number>>(new Map());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const weekStart = format(startOfWeek(parseISO(data.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(weekStart), index), "yyyy-MM-dd"));

  useEffect(() => () => { undoTimers.current.forEach((timer) => window.clearTimeout(timer)); }, []);

  useEffect(() => {
    if (!data.weekCompletion.some((day) => day.date === selectedCompletionDate)) {
      setSelectedCompletionDate(data.date);
    }
  }, [data.date, data.weekCompletion, selectedCompletionDate]);

  useEffect(() => {
    if (restoringIds.size === 0) return;
    const activeIds = new Set([...data.active, ...data.overdue].map((task) => task.id));
    const restoredIds = [...restoringIds].filter((id) => activeIds.has(id));
    if (restoredIds.length === 0) return;

    setDeferredTasks((current) => {
      const next = new Map(current);
      restoredIds.forEach((id) => next.delete(id));
      return next;
    });
    setRestoringIds((current) => {
      const next = new Set(current);
      restoredIds.forEach((id) => next.delete(id));
      return next;
    });
    setFinishingIds((current) => {
      const next = new Set(current);
      restoredIds.forEach((id) => next.delete(id));
      return next;
    });
    setPendingIds((current) => {
      const next = new Set(current);
      restoredIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [data.active, data.overdue, restoringIds]);

  function updateIdSet(setter: React.Dispatch<React.SetStateAction<Set<PlannerId>>>, id: PlannerId, present: boolean) {
    setter((current) => { const next = new Set(current); if (present) next.add(id); else next.delete(id); return next; });
  }

  function removeDeferred(id: PlannerId) {
    const timer = undoTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    undoTimers.current.delete(id);
    setUndoItems((current) => current.filter((item) => item.id !== id));
    setDeferredTasks((current) => { const next = new Map(current); next.delete(id); return next; });
    updateIdSet(setRestoringIds, id, false);
    updateIdSet(setFinishingIds, id, false);
    updateIdSet(setPendingIds, id, false);
  }

  function dismissUndo(id: PlannerId) {
    const timer = undoTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    undoTimers.current.delete(id);
    setUndoItems((current) => current.filter((item) => item.id !== id));
  }

  function addUndo(task: TodayTask) {
    setUndoItems((current) => [
      ...current,
      { id: task.id, title: task.title, revision: (task.revision ?? 1) + 1 },
    ]);
    const timer = window.setTimeout(() => {
      removeDeferred(task.id);
      router.refresh();
    }, COMPLETION_UNDO_MS);
    undoTimers.current.set(task.id, timer);
  }

  async function complete(task: TodayTask, overdue: boolean, index: number) {
    const form = new FormData();
    form.set("id", String(task.id));
    form.set("revision", String(task.revision ?? 1));
    form.set("completed", "true");
    setDeferredTasks((current) => new Map(current).set(task.id, { task, overdue, index }));
    updateIdSet(setPendingIds, task.id, true);
    updateIdSet(setFinishingIds, task.id, true);
    setError(null);
    const result = await toggleTask(form);
    if (!result.ok) {
      removeDeferred(task.id);
      return setError(result.error);
    }
    addUndo(task);
    updateIdSet(setPendingIds, task.id, false);
    window.setTimeout(() => updateIdSet(setFinishingIds, task.id, false), COMPLETION_FEEDBACK_MS);
  }

  async function undoCompletion(item: UndoItem) {
    const form = new FormData();
    form.set("id", String(item.id));
    form.set("revision", String(item.revision));
    form.set("completed", "false");
    const timer = undoTimers.current.get(item.id);
    if (timer) window.clearTimeout(timer);
    updateIdSet(setRestoringIds, item.id, true);
    updateIdSet(setUndoingIds, item.id, true);
    const result = await toggleTask(form);
    updateIdSet(setUndoingIds, item.id, false);
    if (!result.ok) {
      updateIdSet(setRestoringIds, item.id, false);
      const retryTimer = window.setTimeout(() => { removeDeferred(item.id); router.refresh(); }, COMPLETION_UNDO_MS);
      undoTimers.current.set(item.id, retryTimer);
      return setError(result.error);
    }
    dismissUndo(item.id);
  }

  async function addTask(form: FormData) {
    setComposerPending(true); setError(null);
    const result = await createTask(form);
    setComposerPending(false);
    if (!result.ok) { setError(result.error); return false; }
    return true;
  }

  async function saveTask(form: FormData) {
    setEditPending(true); setError(null);
    const result = await updateTask(form);
    setEditPending(false);
    if (!result.ok) { setError(result.error); return false; }
    return true;
  }

  async function removeTask(form: FormData) {
    setDeletePending(true); setError(null);
    const result = await deleteTask(form);
    setDeletePending(false);
    if (!result.ok) { setError(result.error); return false; }
    return true;
  }

  function mergeDeferred(tasks: TodayTask[], overdue: boolean) {
    const next = tasks.filter((task) => !deferredTasks.has(task.id));
    [...deferredTasks.values()]
      .filter((item) => item.overdue === overdue)
      .sort((left, right) => left.index - right.index)
      .forEach((item) => next.splice(Math.min(item.index, next.length), 0, item.task));
    return next;
  }

  const visibleOverdue = mergeDeferred(data.overdue, true);
  const visibleActive = mergeDeferred(data.active, false);
  const visibleScheduled = visibleActive.filter((task) => !task.anytimeWeekStart);
  const visibleAnytime = visibleActive.filter((task) => Boolean(task.anytimeWeekStart));
  const visibleCompletedToday = data.completedToday.filter((task) => !deferredTasks.has(task.id));
  const deferredCompletedCount = data.completedToday.length - visibleCompletedToday.length;
  const visibleCounts = {
    completed: Math.max(0, data.counts.completed - deferredCompletedCount),
    remaining: data.counts.remaining + deferredCompletedCount,
    planned: data.counts.planned,
  };
  const deferredNotReflected = [...deferredTasks.keys()].filter((id) => !restoringIds.has(id) && !data.completedToday.some((task) => task.id === id)).length;
  const restoringReflected = [...restoringIds].filter((id) => data.completedToday.some((task) => task.id === id)).length;
  const optimisticCompleted = Math.max(0, data.counts.completed - restoringReflected + deferredNotReflected);
  const progressCounts = {
    completed: Math.min(data.counts.planned, optimisticCompleted),
    remaining: Math.max(0, data.counts.planned - optimisticCompleted),
    planned: data.counts.planned,
  };
  const weekCompletion = data.weekCompletion.map((day) => day.date === data.date
    ? {
        ...day,
        completed: progressCounts.completed,
        planned: progressCounts.planned,
        remaining: progressCounts.remaining,
        percentage: progressCounts.planned
          ? Math.round((progressCounts.completed / progressCounts.planned) * 100)
          : 0,
      }
    : day);

  return (
    <div className="dashboard-shell mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-7">
      <header className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-kicker"><span className="dashboard-hero-kicker-mark"><Sparkles size={12} /></span><span>{greeting}</span><span className="dashboard-hero-kicker-divider" aria-hidden="true" /><span>{format(parseISO(data.date), "EEEE, MMMM d")}</span></div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-[2.6rem]">What matters today?</h1>
          <p className="dashboard-hero-copy-text">A clear view of the next useful thing, with room for everything else.</p>
        </div>
        <div className="dashboard-hero-action"><span className="dashboard-hero-date">Today <span aria-hidden="true">·</span> {format(parseISO(data.date), "MMM d")}</span><button onClick={() => setComposer(true)} className="premium-primary-button"><Plus size={16} /> Add task</button></div>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}<button onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button></div>}
      {composer && <TaskComposer weekStart={weekStart} days={weekDays} pending={composerPending} onSubmit={addTask} onClose={() => setComposer(false)} />}
      {editingTask && <DashboardTaskEditor task={editingTask} pending={editPending} deletePending={deletePending} onSave={saveTask} onDelete={removeTask} onClose={() => setEditingTask(null)} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(300px,.88fr)]">
        <section className="glass-panel overflow-hidden rounded-[28px]">
          <div className="dashboard-card-heading">
            <div>
              <p className="dashboard-eyebrow">Today</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-semibold tracking-[-0.035em]">{progressCounts.completed} of {progressCounts.planned} complete</h2>
                <span className="text-xs text-muted-foreground">{progressCounts.remaining} remaining</span>
              </div>
            </div>
            <ProgressDial completed={progressCounts.completed} total={progressCounts.planned} />
          </div>
          {progressCounts.planned > 0 && <div className="h-1 bg-muted/80"><div className="h-full rounded-r-full bg-[var(--orange)] transition-[width] duration-500" style={{ width: `${(progressCounts.completed / progressCounts.planned) * 100}%` }} /></div>}
          <div className="p-3 sm:p-4">
            {visibleCounts.remaining === 0 ? <EmptyToday completed={visibleCounts.completed} onAdd={() => setComposer(true)} /> : <div className="space-y-1">
              {visibleOverdue.length > 0 && <TaskGroupLabel label="Carried forward" count={visibleOverdue.length} />}
              {visibleOverdue.map((task, index) => <DashboardTask key={task.id} task={task} overdue pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} deferred={deferredTasks.has(task.id) && !restoringIds.has(task.id)} restoring={restoringIds.has(task.id)} undoing={undoingIds.has(task.id)} onComplete={() => complete(task, true, index)} onUndo={() => undoCompletion({ id: task.id, title: task.title, revision: (task.revision ?? 1) + 1 })} onEdit={() => setEditingTask(task)} />)}
              {visibleScheduled.length > 0 && <TaskGroupLabel label="Planned today" count={visibleScheduled.length} />}
              {visibleScheduled.map((task) => { const index = visibleActive.findIndex((item) => item.id === task.id); return <DashboardTask key={task.id} task={task} pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} deferred={deferredTasks.has(task.id) && !restoringIds.has(task.id)} restoring={restoringIds.has(task.id)} undoing={undoingIds.has(task.id)} onComplete={() => complete(task, false, index)} onUndo={() => undoCompletion({ id: task.id, title: task.title, revision: (task.revision ?? 1) + 1 })} onEdit={() => setEditingTask(task)} />; })}
              {visibleAnytime.length > 0 && <TaskGroupLabel label="Anytime this week" count={visibleAnytime.length} />}
              {visibleAnytime.map((task) => { const index = visibleActive.findIndex((item) => item.id === task.id); return <DashboardTask key={task.id} task={task} pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} deferred={deferredTasks.has(task.id) && !restoringIds.has(task.id)} restoring={restoringIds.has(task.id)} undoing={undoingIds.has(task.id)} onComplete={() => complete(task, false, index)} onUndo={() => undoCompletion({ id: task.id, title: task.title, revision: (task.revision ?? 1) + 1 })} onEdit={() => setEditingTask(task)} />; })}
            </div>}
            {visibleCompletedToday.length > 0 && <div className="mt-5 border-t border-border px-1 pt-5">
              <div className="mb-2.5 flex items-center justify-between px-2"><div><p className="dashboard-eyebrow">Completed today</p><p className="mt-1 text-xs text-muted-foreground">Quiet proof of progress.</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{visibleCompletedToday.length}</span></div>
              <div className="space-y-0.5">{visibleCompletedToday.map((task) => <CompletedTask key={task.id} task={task} onEdit={() => setEditingTask(task)} />)}</div>
            </div>}
          </div>
        </section>
        <ThoughtsPanel recent={data.recentThoughts} all={data.allThoughts} onError={setError} />
      </div>

      <WeekCompletionStrip
        days={weekCompletion}
        today={data.date}
        selectedDate={selectedCompletionDate}
        onSelect={setSelectedCompletionDate}
      />

      <StreakBanner streak={data.streak} />

      {undoItems.length > 0 && <div className="completion-toast-stack" aria-label="Recently completed tasks">{undoItems.map((item) => <div key={item.id} role="status" className="completion-toast"><span className="completion-toast-icon"><Check size={15} strokeWidth={3} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Task completed</p><p className="truncate text-xs text-muted-foreground">{item.title}</p></div><button onClick={() => undoCompletion(item)} disabled={undoingIds.has(item.id)} className="completion-undo-button"><RotateCcw size={13} /> {undoingIds.has(item.id) ? "Restoring…" : "Undo"}</button><span className="completion-toast-timer" /></div>)}</div>}
    </div>
  );
}

function WeekCompletionStrip({
  days,
  today,
  selectedDate,
  onSelect,
}: {
  days: DashboardData["weekCompletion"];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const selected = days.find((day) => day.date === selectedDate) ?? days[0]!;
  const selectedLabel = selected.date === today
    ? "Today"
    : format(parseISO(selected.date), "EEEE");
  return (
    <section className="week-completion-panel" aria-labelledby="week-completion-title">
      <header className="week-completion-heading">
        <div>
          <p className="dashboard-eyebrow">This week</p>
          <h2 id="week-completion-title">Daily completion</h2>
        </div>
        <div className="week-completion-summary" aria-live="polite">
          <strong>{selectedLabel}: {selected.completed} of {selected.planned} complete</strong>
          <span>{selected.remaining} remaining · {selected.percentage}%</span>
        </div>
      </header>
      <div className="week-completion-days" role="group" aria-label="Select a day to view its completion summary">
        {days.map((day) => {
          const label = `${format(parseISO(day.date), "EEEE")}: ${day.completed} of ${day.planned} complete, ${day.remaining} remaining, ${day.percentage} percent`;
          const selectedDay = day.date === selected.date;
          return (
            <button
              key={day.date}
              type="button"
              className={`week-completion-day ${selectedDay ? "week-completion-day-selected" : ""} ${day.date === today ? "week-completion-day-today" : ""}`}
              aria-label={label}
              aria-pressed={selectedDay}
              aria-current={day.date === today ? "date" : undefined}
              onClick={() => onSelect(day.date)}
            >
              <span className="week-completion-weekday" aria-hidden="true">{format(parseISO(day.date), "EEE")}</span>
              <span className="week-completion-date" aria-hidden="true">{format(parseISO(day.date), "d")}</span>
              <span className="week-completion-track" aria-hidden="true">
                <span style={{ height: `${day.percentage}%` }} />
              </span>
              <span className="week-completion-fraction" aria-hidden="true">{day.completed}/{day.planned}</span>
            </button>
          );
        })}
      </div>
      <div className="week-completion-legend" aria-hidden="true"><span>Completion</span><i /><span>0%</span><i className="week-completion-legend-full" /><span>100%</span></div>
    </section>
  );
}

function StreakBanner({ streak }: { streak: DashboardData["streak"] }) {
  const stateCopy = streak.current === 0 ? "Complete one task to begin" : streak.state === "hot" ? "Steady momentum" : streak.state === "cooling" ? "One grace day used" : "Last redemption day";
  return <section className={`streak-banner streak-${streak.state}`} aria-label={`${streak.current}-day productive streak`}><span className="streak-icon"><Flame size={18} strokeWidth={1.8} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><p className="font-semibold tracking-[-0.025em]">{streak.current}-day streak</p><span className="text-xs text-muted-foreground">{stateCopy}</span></div><p className="mt-0.5 text-[11px] text-muted-foreground">Best · {streak.best} {streak.best === 1 ? "day" : "days"}</p></div><Sparkles size={15} className="shrink-0 text-[var(--orange)] opacity-60" /></section>;
}

function ProgressDial({ completed, total }: { completed: number; total: number }) {
  const progress = total ? Math.round((completed / total) * 100) : 0;
  return <div className="dashboard-progress-dial"><svg viewBox="0 0 48 48" aria-hidden="true"><circle className="dashboard-progress-track" cx="24" cy="24" r="19" pathLength="100" /><circle className="dashboard-progress-value" cx="24" cy="24" r="19" pathLength="100" style={{ strokeDashoffset: 100 - progress }} /></svg><span key={progress}>{progress}%</span></div>;
}

function TaskGroupLabel({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><span>{label}</span><span className="opacity-60">{count}</span></div>;
}

function DashboardTask({ task, overdue = false, pending, finishing, deferred, restoring, undoing, onComplete, onUndo, onEdit }: { task: TodayTask; overdue?: boolean; pending: boolean; finishing: boolean; deferred: boolean; restoring: boolean; undoing: boolean; onComplete: () => void; onUndo: () => void; onEdit: () => void }) {
  return <article className={`dashboard-task-row group ${finishing ? "dashboard-task-finishing" : ""} ${deferred && !finishing ? "dashboard-task-awaiting" : ""}`}><TaskCompletionButton title={task.title} completed={deferred} pending={pending || undoing || restoring} animating={finishing} onClick={deferred ? onUndo : onComplete} className={`mt-0 ${deferred ? "task-check-undoable" : ""}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium leading-5">{task.title}</p>{overdue && !deferred && <span className="overdue-pill">From {format(parseISO(task.date), "MMM d")}</span>}</div><p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">{categoryLabels[task.category]}{task.estimatedMinutes ? <><span>·</span><Clock3 size={11} /> {task.estimatedMinutes} min</> : null}{deferred ? <><span>·</span>Completed</> : task.status !== "not_started" ? <><span>·</span>{task.status.replace("_", " ")}</> : null}</p></div><button type="button" onClick={onEdit} aria-label={`Edit ${task.title}`} className="dashboard-task-edit-button"><Pencil size={14} /></button></article>;
}

function CompletedTask({ task, onEdit }: { task: TodayTask; onEdit: () => void }) {
  return <article className="dashboard-completed-task group"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--orange)]/15 text-[var(--orange)]"><Check size={12} strokeWidth={3} /></span><p className="min-w-0 flex-1 truncate text-sm line-through decoration-[var(--orange)]/55">{task.title}</p><span className="shrink-0 text-[10px]">{task.completedAt ? format(new Date(task.completedAt), "HH:mm") : categoryLabels[task.category]}</span>{!task.recurrenceId && <button type="button" onClick={onEdit} className="dashboard-task-edit-button" aria-label={`Edit ${task.title}`}><Pencil size={13} /></button>}</article>;
}

function DashboardTaskEditor({ task, pending, deletePending, onSave, onDelete, onClose }: { task: TodayTask; pending: boolean; deletePending: boolean; onSave: (form: FormData) => Promise<boolean>; onDelete: (form: FormData) => Promise<boolean>; onClose: () => void }) {
  const taskWeekStart = format(startOfWeek(parseISO(task.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(taskWeekStart), index), "yyyy-MM-dd"));
  const [date, setDate] = useState(task.date);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const dialogRef = useDialogContract<HTMLFormElement>({ blocked: pending || saving || deletePending || closing, onClose: close });

  function close() {
    if (closing || pending || saving || deletePending) return;
    setClosing(true);
    window.setTimeout(onClose, DIALOG_EXIT_MS);
  }
  async function submit(form: FormData) {
    form.set("revision", String(task.revision ?? 1));
    setSaving(true);
    const saved = await onSave(form);
    if (saved) close(); else setSaving(false);
  }
  async function remove() {
    const form = new FormData();
    form.set("id", String(task.id));
    form.set("revision", String(task.revision ?? 1));
    const deleted = await onDelete(form);
    if (deleted) onClose();
  }
  if (!mounted) return null;

  return createPortal(<div className={`modal-backdrop ${closing ? "modal-closing" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><form ref={dialogRef} tabIndex={-1} action={submit} aria-busy={pending || saving || deletePending} className="task-composer dashboard-task-editor" role="dialog" aria-modal="true" aria-labelledby="dashboard-edit-title" aria-describedby="dashboard-edit-description"><div className="flex items-start justify-between gap-4"><div><p className="dashboard-eyebrow">Today</p><h2 id="dashboard-edit-title" className="mt-1 text-lg font-semibold">Edit task</h2><p id="dashboard-edit-description" className="mt-1 text-xs text-muted-foreground">Adjust it here without leaving your day.</p></div><button type="button" onClick={close} disabled={pending || saving || deletePending} className="milestone-icon-button" aria-label="Close task editor"><X size={17} /></button></div><input type="hidden" name="id" value={task.id} /><input type="hidden" name="anytimeWeekStart" value={task.anytimeWeekStart ?? ""} /><input type="hidden" name="recurrenceCount" value="0" /><input type="hidden" name="priority" value={task.priority} /><input type="hidden" name="category" value={category} /><input name="title" defaultValue={task.title} required maxLength={200} autoFocus className="focus-input mt-5" /><textarea name="description" defaultValue={task.description ?? ""} maxLength={2000} rows={3} placeholder="Optional details" className="thought-edit-input mt-3" /><div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">When</p><div className="choice-grid">{dates.map((value) => <button type="button" key={value} onClick={() => setDate(value)} className={date === value ? "choice-chip choice-chip-active" : "choice-chip"}>{format(parseISO(value), "EEE d")}</button>)}</div><input type="hidden" name="date" value={date} /></div><div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Category</p><div className="choice-grid">{taskCategories.map((value) => <button type="button" key={value} onClick={() => setCategory(value)} className={category === value ? "choice-chip choice-chip-active" : "choice-chip"}>{categoryLabels[value]}</button>)}</div></div><label className="mt-4 block text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Estimate<input name="estimatedMinutes" type="number" min="1" max="1440" defaultValue={task.estimatedMinutes ?? ""} placeholder="Minutes" className="focus-input mt-2 normal-case tracking-normal" /></label>{(pending || saving || deletePending) && <div role="status" className="task-save-status"><LoaderCircle size={14} className="animate-spin" /> {deletePending ? "Deleting task…" : "Saving task…"}</div>}<div className="task-composer-actions mt-5 flex flex-wrap items-center justify-between gap-2"><div>{confirmDelete ? <span role="alert" className="inline-flex items-center gap-2"><span className="text-xs text-muted-foreground">Delete this task?</span><button type="button" onClick={() => setConfirmDelete(false)} disabled={deletePending} className="thought-quiet-button">Keep</button><button type="button" onClick={remove} disabled={deletePending} className="entity-delete-button">{deletePending ? "Deleting…" : "Delete"}</button></span> : <button type="button" onClick={() => setConfirmDelete(true)} disabled={pending || saving} className="thought-quiet-button text-red-600"><Trash2 size={14} /> Delete</button>}</div><div className="flex gap-2"><button type="button" onClick={close} disabled={pending || saving || deletePending} className="thought-quiet-button">Cancel</button><button disabled={pending || saving || deletePending} className="premium-small-button">{pending || saving ? <><LoaderCircle size={13} className="animate-spin" /> Saving…</> : "Save changes"}</button></div></div></form></div>, document.body);
}

function EmptyToday({ completed, onAdd }: { completed: number; onAdd: () => void }) {
  return <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground"><Check size={18} /></span><p className="mt-3 font-semibold">{completed ? "Today is clear." : "A clear day, ready when you are."}</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{completed ? "You finished what was on your plate." : "Add one concrete action when something matters."}</p><button type="button" onClick={onAdd} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground"><Plus size={13} /> Add task</button></div>;
}

function ThoughtsPanel({ recent, all, onError }: { recent: QuickThought[]; all: QuickThought[]; onError: (message: string) => void }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [backgroundRecent, setBackgroundRecent] = useState(recent);
  const [closingAll, setClosingAll] = useState(false);
  const [captureState, setCaptureState] = useState<"idle" | "saving" | "saved">("idle");
  const [editingId, setEditingId] = useState<PlannerId | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlannerId | null>(null);
  useEffect(() => { if (!showAll) setBackgroundRecent(recent); }, [recent, showAll]);
  async function run(action: (form: FormData) => Promise<ActionResult>, form: FormData, onSuccess?: () => void) { setPending(true); const result = await action(form); setPending(false); if (!result.ok) { onError(result.error); return false; } onSuccess?.(); return true; }
  async function capture(form: FormData) {
    setCaptureState("saving");
    const saved = await run(createThought, form, () => setText(""));
    if (!saved) return setCaptureState("idle");
    setCaptureState("saved");
    window.setTimeout(() => setCaptureState("idle"), 1200);
  }
  function closeAll() {
    if (closingAll) return;
    setClosingAll(true);
    window.setTimeout(() => { setShowAll(false); setClosingAll(false); setEditingId(null); setConfirmDelete(null); }, 240);
  }
  return <section className="glass-panel overflow-hidden rounded-[28px]"><div className="dashboard-card-heading"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground"><Lightbulb size={18} /></span><div><p className="dashboard-eyebrow">Quick thought</p><h2 className="mt-1 text-base font-semibold tracking-[-0.025em]">Catch it before it goes</h2></div></div></div><form action={capture} className={`thought-capture px-4 pb-4 sm:px-5 sm:pb-5 thought-capture-${captureState}`}><textarea name="text" value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={1200} placeholder="What’s on your mind?" className="thought-input" /><div className="mt-2.5 flex items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">Saved to your planner · {text.length}/1200</span><button disabled={pending || !text.trim()} className="premium-small-button">{captureState === "saving" ? "Saving…" : captureState === "saved" ? <><Check size={13} /> Saved</> : "Save thought"}</button></div></form><div className="border-t border-border px-4 py-4 sm:px-5"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Latest</p>{all.length > 0 && <button onClick={() => { setClosingAll(false); setShowAll(true); }} className="view-all-button">View all <ArrowRight size={12} /></button>}</div>{backgroundRecent.length ? <div className="space-y-1">{backgroundRecent.map((thought) => <ThoughtRow key={thought.id} thought={thought} editing={!showAll && editingId === thought.id} confirming={!showAll && confirmDelete === thought.id} pending={pending} onEdit={() => setEditingId(thought.id)} onCancel={() => { setEditingId(null); setConfirmDelete(null); }} onConfirmDelete={() => setConfirmDelete(thought.id)} onSave={(form) => run(updateThought, form, () => setEditingId(null))} onDelete={(form) => run(deleteThought, form, () => setConfirmDelete(null))} />)}</div> : <EmptyThoughts compact />}</div>{showAll && <ThoughtsDialog thoughts={all} closing={closingAll} pending={pending} editingId={editingId} confirmingId={confirmDelete} setEditingId={setEditingId} setConfirmDelete={setConfirmDelete} onClose={closeAll} onSave={(form) => run(updateThought, form, () => setEditingId(null))} onDelete={(form) => run(deleteThought, form, () => setConfirmDelete(null))} />}</section>;
}

function EmptyThoughts({ compact = false }: { compact?: boolean }) {
  return <div className={`thoughts-empty-state entity-empty-state ${compact ? "thoughts-empty-compact" : ""}`}><span><Lightbulb size={compact ? 15 : 18} /></span><div><p>No captured thoughts yet.</p><small>Save a quick thought and it will appear here.</small></div></div>;
}

function ThoughtRow({ thought, editing, confirming, pending, onEdit, onCancel, onConfirmDelete, onSave, onDelete }: { thought: QuickThought; editing: boolean; confirming: boolean; pending: boolean; onEdit: () => void; onCancel: () => void; onConfirmDelete: () => void; onSave: (form: FormData) => Promise<boolean>; onDelete: (form: FormData) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function save(form: FormData) { form.set("revision", String(thought.revision ?? 1)); setSaving(true); await new Promise((resolve) => window.setTimeout(resolve, 180)); const saved = await onSave(form); if (!saved) setSaving(false); }
  async function remove(form: FormData) { form.set("revision", String(thought.revision ?? 1)); setDeleting(true); const deleted = await onDelete(form); if (!deleted) setDeleting(false); }
  if (editing) return <form action={save} className={`thought-edit-form entity-editor-enter ${saving ? "entity-saving" : ""}`}><input type="hidden" name="id" value={thought.id} /><textarea autoFocus name="text" defaultValue={thought.text} rows={3} maxLength={1200} className="thought-edit-input" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onCancel} className="thought-quiet-button">Cancel</button><button disabled={pending || saving} className="premium-small-button">{saving ? "Saving…" : "Save"}</button></div></form>;
  return <article className={`thought-row group ${deleting ? "entity-deleting" : ""}`}><div className="min-w-0 flex-1"><p className="line-clamp-3 text-xs leading-5">{thought.text}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{formatThoughtTime(thought.createdAt)}</p></div><div className="flex shrink-0 items-center">{confirming ? <div role="alert" className="thought-delete-confirm"><span>Remove?</span><button type="button" onClick={onCancel} className="entity-delete-cancel">Keep</button><form action={remove}><input type="hidden" name="id" value={thought.id} /><button disabled={pending || deleting} className="entity-delete-button">{deleting ? "Removing…" : "Remove"}</button></form></div> : <><button onClick={onEdit} className="thought-icon-button" aria-label="Edit thought"><Pencil size={13} /></button><button onClick={onConfirmDelete} className="thought-icon-button hover:text-rose-700" aria-label="Delete thought"><Trash2 size={13} /></button></>}</div></article>;
}

function ThoughtsDialog({ thoughts, closing, pending, editingId, confirmingId, setEditingId, setConfirmDelete, onClose, onSave, onDelete }: { thoughts: QuickThought[]; closing: boolean; pending: boolean; editingId: PlannerId | null; confirmingId: PlannerId | null; setEditingId: (id: PlannerId | null) => void; setConfirmDelete: (id: PlannerId | null) => void; onClose: () => void; onSave: (form: FormData) => Promise<boolean>; onDelete: (form: FormData) => Promise<boolean> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dialogRef = useDialogContract<HTMLElement>({ blocked: pending || closing, onClose });
  if (!mounted) return null;
  return createPortal(<div className={`thought-dialog-backdrop ${closing ? "thought-dialog-backdrop-closing" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="thoughts-title" aria-describedby="thoughts-description" className={`thought-dialog ${closing ? "thought-dialog-closing" : ""}`}><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="dashboard-eyebrow">Quick thoughts</p><h2 id="thoughts-title" className="mt-1 text-lg font-semibold tracking-[-.03em]">All captured thoughts</h2><p id="thoughts-description" className="mt-1 text-xs text-muted-foreground">Review, edit, or remove captured thoughts.</p></div><button autoFocus onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Close thoughts"><X size={18} /></button></header><div className="max-h-[min(68vh,620px)] overflow-y-auto p-3 sm:p-4">{thoughts.length ? <div className="space-y-1">{thoughts.map((thought) => <ThoughtRow key={thought.id} thought={thought} editing={editingId === thought.id} confirming={confirmingId === thought.id} pending={pending} onEdit={() => setEditingId(thought.id)} onCancel={() => { setEditingId(null); setConfirmDelete(null); }} onConfirmDelete={() => setConfirmDelete(thought.id)} onSave={onSave} onDelete={onDelete} />)}</div> : <EmptyThoughts />}</div></section></div>, document.body);
}

function formatThoughtTime(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() ? format(date, "MMM d · HH:mm") : format(date, "MMM d, yyyy · HH:mm"); }
