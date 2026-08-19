"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Clock3, Flame, Lightbulb, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { createThought, deleteThought, updateThought } from "@/src/app/dashboard-actions";
import { createTask, toggleTask, type ActionResult } from "@/src/app/today/actions";
import type { DashboardData, QuickThought } from "@/src/lib/dashboard";
import type { TaskCategory, TodayTask } from "@/src/lib/today";
import { TaskComposer } from "@/src/components/week-view";

const categoryLabels: Record<TaskCategory, string> = { career: "Career", content: "Content", other: "Personal" };
const undoDuration = 6000;
type UndoItem = { id: number; title: string };

export function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [finishingIds, setFinishingIds] = useState<Set<number>>(() => new Set());
  const [undoingIds, setUndoingIds] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [undoItems, setUndoItems] = useState<UndoItem[]>([]);
  const [composer, setComposer] = useState(false);
  const [composerPending, setComposerPending] = useState(false);
  const undoTimers = useRef<Map<number, number>>(new Map());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(weekStart), index), "yyyy-MM-dd"));

  useEffect(() => () => { undoTimers.current.forEach((timer) => window.clearTimeout(timer)); }, []);

  function updateIdSet(setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number, present: boolean) {
    setter((current) => { const next = new Set(current); if (present) next.add(id); else next.delete(id); return next; });
  }

  function dismissUndo(id: number) {
    const timer = undoTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    undoTimers.current.delete(id);
    setUndoItems((current) => current.filter((item) => item.id !== id));
  }

  function addUndo(task: TodayTask) {
    dismissUndo(task.id);
    setUndoItems((current) => [...current, { id: task.id, title: task.title }]);
    const timer = window.setTimeout(() => dismissUndo(task.id), undoDuration);
    undoTimers.current.set(task.id, timer);
  }

  async function complete(task: TodayTask) {
    const form = new FormData();
    form.set("id", String(task.id));
    updateIdSet(setPendingIds, task.id, true);
    updateIdSet(setFinishingIds, task.id, true);
    setError(null);
    const result = await toggleTask(form);
    if (!result.ok) {
      updateIdSet(setPendingIds, task.id, false);
      updateIdSet(setFinishingIds, task.id, false);
      return setError(result.error);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 620));
    addUndo(task);
    updateIdSet(setPendingIds, task.id, false);
    updateIdSet(setFinishingIds, task.id, false);
    router.refresh();
  }

  async function undoCompletion(item: UndoItem) {
    const form = new FormData();
    form.set("id", String(item.id));
    updateIdSet(setUndoingIds, item.id, true);
    const result = await toggleTask(form);
    updateIdSet(setUndoingIds, item.id, false);
    if (!result.ok) return setError(result.error);
    dismissUndo(item.id);
    router.refresh();
  }

  async function addTask(form: FormData) {
    setComposerPending(true); setError(null);
    const result = await createTask(form);
    setComposerPending(false);
    if (!result.ok) return setError(result.error);
    setComposer(false); router.refresh();
  }

  return (
    <div className="dashboard-shell mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting} · {format(parseISO(data.date), "EEEE, MMMM d")}</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.055em] sm:text-[2.6rem]">What matters today?</h1>
        </div>
        <button onClick={() => setComposer(true)} className="premium-primary-button"><Plus size={16} /> Add task</button>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}<button onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button></div>}
      {composer && <TaskComposer weekStart={weekStart} days={weekDays} pending={composerPending} onSubmit={addTask} onClose={() => setComposer(false)} />}

      <StreakBanner streak={data.streak} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(300px,.88fr)]">
        <section className="glass-panel overflow-hidden rounded-[28px]">
          <div className="dashboard-card-heading">
            <div>
              <p className="dashboard-eyebrow">Today</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-semibold tracking-[-0.035em]">{data.counts.completed} of {data.counts.planned} complete</h2>
                <span className="text-xs text-muted-foreground">{data.counts.remaining} remaining</span>
              </div>
            </div>
            <ProgressDial completed={data.counts.completed} total={data.counts.planned} />
          </div>
          <div className="h-1 bg-muted/80"><div className="h-full rounded-r-full bg-[var(--orange)] transition-[width] duration-500" style={{ width: `${data.counts.planned ? (data.counts.completed / data.counts.planned) * 100 : 0}%` }} /></div>
          <div className="p-3 sm:p-4">
            {data.counts.remaining === 0 ? <EmptyToday completed={data.counts.completed} onAdd={() => setComposer(true)} /> : <div className="space-y-1">
              {data.overdue.length > 0 && <TaskGroupLabel label="Carried forward" count={data.overdue.length} />}
              {data.overdue.map((task) => <DashboardTask key={task.id} task={task} overdue pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} onComplete={() => complete(task)} />)}
              {data.overdue.length > 0 && data.active.length > 0 && <TaskGroupLabel label="Planned today" count={data.active.length} />}
              {data.active.map((task) => <DashboardTask key={task.id} task={task} pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} onComplete={() => complete(task)} />)}
            </div>}
            {data.completedToday.length > 0 && <div className="mt-5 border-t border-border px-1 pt-5">
              <div className="mb-2.5 flex items-center justify-between px-2"><div><p className="dashboard-eyebrow">Completed today</p><p className="mt-1 text-xs text-muted-foreground">Quiet proof of progress.</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{data.completedToday.length}</span></div>
              <div className="space-y-0.5">{data.completedToday.map((task) => <CompletedTask key={task.id} task={task} />)}</div>
            </div>}
          </div>
        </section>
        <ThoughtsPanel recent={data.recentThoughts} all={data.allThoughts} onError={setError} />
      </div>

      {undoItems.length > 0 && <div className="completion-toast-stack" aria-label="Recently completed tasks">{undoItems.map((item) => <div key={item.id} role="status" className="completion-toast"><span className="completion-toast-icon"><Check size={15} strokeWidth={3} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Task completed</p><p className="truncate text-xs text-muted-foreground">{item.title}</p></div><button onClick={() => undoCompletion(item)} disabled={undoingIds.has(item.id)} className="completion-undo-button"><RotateCcw size={13} /> {undoingIds.has(item.id) ? "Restoring…" : "Undo"}</button><span className="completion-toast-timer" /></div>)}</div>}
    </div>
  );
}

function StreakBanner({ streak }: { streak: DashboardData["streak"] }) {
  const stateCopy = streak.state === "hot" ? "Steady momentum" : streak.state === "cooling" ? "One grace day used" : "Last redemption day";
  return <section className={`streak-banner streak-${streak.state}`}><span className="streak-icon"><Flame size={20} strokeWidth={1.8} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2"><p className="font-semibold tracking-[-0.025em]">{streak.current} productive {streak.current === 1 ? "day" : "days"}</p><span className="text-xs text-muted-foreground">{stateCopy}</span></div><p className="mt-0.5 text-[11px] text-muted-foreground">Best streak · {streak.best} productive {streak.best === 1 ? "day" : "days"}</p></div><Sparkles size={16} className="shrink-0 text-[var(--orange)] opacity-70" /></section>;
}

function ProgressDial({ completed, total }: { completed: number; total: number }) {
  const progress = total ? Math.round((completed / total) * 100) : 0;
  return <div className="dashboard-progress-dial" style={{ background: `conic-gradient(var(--orange) ${progress}%, var(--muted) 0)` }}><span>{progress}%</span></div>;
}

function TaskGroupLabel({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><span>{label}</span><span className="opacity-60">{count}</span></div>;
}

function DashboardTask({ task, overdue = false, pending, finishing, onComplete }: { task: TodayTask; overdue?: boolean; pending: boolean; finishing: boolean; onComplete: () => void }) {
  return <article className={`dashboard-task-row group ${finishing ? "dashboard-task-finishing" : ""}`}><button type="button" onClick={onComplete} disabled={pending} className={`task-check mt-0 ${finishing ? "task-check-completed completion-check-bloom" : ""}`} aria-label={`Complete ${task.title}`}>{finishing ? <Check size={12} strokeWidth={3} /> : pending ? <span /> : null}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium leading-5">{task.title}</p>{overdue && <span className="overdue-pill">From {format(parseISO(task.date), "MMM d")}</span>}</div><p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">{categoryLabels[task.category]}{task.estimatedMinutes ? <><span>·</span><Clock3 size={11} /> {task.estimatedMinutes} min</> : null}{task.status !== "not_started" ? <><span>·</span>{task.status.replace("_", " ")}</> : null}</p></div><Link href="/week" aria-label={`Open ${task.title} in This Week`} className="rounded-lg p-2 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground group-hover:opacity-100"><ChevronRight size={16} /></Link></article>;
}

function CompletedTask({ task }: { task: TodayTask }) {
  return <article className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--orange)]/15 text-[var(--orange)]"><Check size={12} strokeWidth={3} /></span><p className="min-w-0 flex-1 truncate text-sm line-through decoration-[var(--orange)]/55">{task.title}</p><span className="shrink-0 text-[10px]">{task.completedAt ? format(new Date(task.completedAt), "HH:mm") : categoryLabels[task.category]}</span></article>;
}

function EmptyToday({ completed, onAdd }: { completed: number; onAdd: () => void }) {
  return <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground"><Check size={18} /></span><p className="mt-3 font-semibold">{completed ? "Today is clear." : "A clear day, ready when you are."}</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{completed ? "You finished what was on your plate." : "Add one concrete action when something matters."}</p><button type="button" onClick={onAdd} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground"><Plus size={13} /> Add task</button></div>;
}

function ThoughtsPanel({ recent, all, onError }: { recent: QuickThought[]; all: QuickThought[]; onError: (message: string) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  async function run(action: (form: FormData) => Promise<ActionResult>, form: FormData, onSuccess?: () => void) { setPending(true); const result = await action(form); setPending(false); if (!result.ok) return onError(result.error); onSuccess?.(); router.refresh(); }
  async function capture(form: FormData) { await run(createThought, form, () => setText("")); }
  return <section className="glass-panel overflow-hidden rounded-[28px]"><div className="dashboard-card-heading"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground"><Lightbulb size={18} /></span><div><p className="dashboard-eyebrow">Quick thought</p><h2 className="mt-1 text-base font-semibold tracking-[-0.025em]">Catch it before it goes</h2></div></div></div><form action={capture} className="px-4 pb-4 sm:px-5 sm:pb-5"><textarea name="text" value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={1200} placeholder="What’s on your mind?" className="thought-input" /><div className="mt-2.5 flex items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">Saved locally · {text.length}/1200</span><button disabled={pending || !text.trim()} className="premium-small-button">{pending ? "Saving…" : "Save thought"}</button></div></form><div className="border-t border-border px-4 py-4 sm:px-5"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Latest</p>{all.length > 0 && <button onClick={() => setShowAll(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground">View all <ArrowRight size={12} /></button>}</div>{recent.length ? <div className="space-y-1">{recent.map((thought) => <ThoughtRow key={thought.id} thought={thought} editing={editingId === thought.id} confirming={confirmDelete === thought.id} pending={pending} onEdit={() => setEditingId(thought.id)} onCancel={() => { setEditingId(null); setConfirmDelete(null); }} onConfirmDelete={() => setConfirmDelete(thought.id)} onSave={(form) => run(updateThought, form, () => setEditingId(null))} onDelete={(form) => run(deleteThought, form, () => setConfirmDelete(null))} />)}</div> : <p className="rounded-2xl bg-muted/45 px-4 py-5 text-center text-xs leading-5 text-muted-foreground">Your latest thoughts will stay close at hand.</p>}</div>{showAll && <ThoughtsDialog thoughts={all} pending={pending} editingId={editingId} confirmingId={confirmDelete} setEditingId={setEditingId} setConfirmDelete={setConfirmDelete} onClose={() => { setShowAll(false); setEditingId(null); setConfirmDelete(null); }} onSave={(form) => run(updateThought, form, () => setEditingId(null))} onDelete={(form) => run(deleteThought, form, () => setConfirmDelete(null))} />}</section>;
}

function ThoughtRow({ thought, editing, confirming, pending, onEdit, onCancel, onConfirmDelete, onSave, onDelete }: { thought: QuickThought; editing: boolean; confirming: boolean; pending: boolean; onEdit: () => void; onCancel: () => void; onConfirmDelete: () => void; onSave: (form: FormData) => Promise<void>; onDelete: (form: FormData) => Promise<void> }) {
  if (editing) return <form action={onSave} className="rounded-2xl border border-[var(--orange)]/30 bg-background/50 p-3"><input type="hidden" name="id" value={thought.id} /><textarea autoFocus name="text" defaultValue={thought.text} rows={3} maxLength={1200} className="thought-edit-input" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onCancel} className="thought-quiet-button">Cancel</button><button disabled={pending} className="premium-small-button">Save</button></div></form>;
  return <article className="thought-row group"><div className="min-w-0 flex-1"><p className="line-clamp-3 text-xs leading-5">{thought.text}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{formatThoughtTime(thought.createdAt)}</p></div><div className="flex shrink-0 items-center">{confirming ? <><span className="mr-1 text-[10px] text-muted-foreground">Delete?</span><form action={onDelete}><input type="hidden" name="id" value={thought.id} /><button disabled={pending} className="rounded-md p-1.5 text-rose-700 hover:bg-rose-500/10" aria-label="Confirm delete"><Check size={14} /></button></form><button onClick={onCancel} className="rounded-md p-1.5 text-muted-foreground" aria-label="Cancel delete"><X size={14} /></button></> : <><button onClick={onEdit} className="thought-icon-button" aria-label="Edit thought"><Pencil size={13} /></button><button onClick={onConfirmDelete} className="thought-icon-button hover:text-rose-700" aria-label="Delete thought"><Trash2 size={13} /></button></>}</div></article>;
}

function ThoughtsDialog({ thoughts, pending, editingId, confirmingId, setEditingId, setConfirmDelete, onClose, onSave, onDelete }: { thoughts: QuickThought[]; pending: boolean; editingId: number | null; confirmingId: number | null; setEditingId: (id: number | null) => void; setConfirmDelete: (id: number | null) => void; onClose: () => void; onSave: (form: FormData) => Promise<void>; onDelete: (form: FormData) => Promise<void> }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", handler); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; }; }, [onClose]);
  return <div className="thought-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="thoughts-title" className="thought-dialog"><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="dashboard-eyebrow">Quick thoughts</p><h2 id="thoughts-title" className="mt-1 text-lg font-semibold tracking-[-.03em]">All captured thoughts</h2></div><button autoFocus onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Close thoughts"><X size={18} /></button></header><div className="max-h-[min(68vh,620px)] overflow-y-auto p-3 sm:p-4"><div className="space-y-1">{thoughts.map((thought) => <ThoughtRow key={thought.id} thought={thought} editing={editingId === thought.id} confirming={confirmingId === thought.id} pending={pending} onEdit={() => setEditingId(thought.id)} onCancel={() => { setEditingId(null); setConfirmDelete(null); }} onConfirmDelete={() => setConfirmDelete(thought.id)} onSave={onSave} onDelete={onDelete} />)}</div></div></section></div>;
}

function formatThoughtTime(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() ? format(date, "MMM d · HH:mm") : format(date, "MMM d, yyyy · HH:mm"); }
