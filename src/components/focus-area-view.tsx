"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { Check, ChevronDown, Clock3, Flag, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { createMilestone, deleteMilestone, toggleMilestone, updateMilestone } from "@/src/app/content-actions";
import { createTask, toggleTask, type ActionResult } from "@/src/app/today/actions";
import type { FocusArea, FocusMilestone, FocusAreaData } from "@/src/lib/focus-areas";
import type { TodayTask } from "@/src/lib/today";
import { TaskComposer } from "@/src/components/week-view";

const statusLabels = { not_started: "Upcoming", in_progress: "Doing", on_hold: "On hold", done: "Done", completed: "Completed", skipped: "Skipped" } as const;
const milestoneTypeLabels = { views: "Views", likes: "Likes", followers: "Followers", applications: "Applications", interviews: "Interviews", offers: "Offers", custom: "Custom" } as const;
const milestoneTypeOptions: Record<FocusArea, Array<{ value: FocusMilestone["type"]; label: string; hint: string }>> = {
  career: [
    { value: "applications", label: "Applications", hint: "Roles applied to" },
    { value: "interviews", label: "Interviews", hint: "Interview outcomes" },
    { value: "offers", label: "Offers", hint: "Offers received" },
    { value: "custom", label: "Custom", hint: "Any career outcome" },
  ],
  content: [
    { value: "views", label: "Views", hint: "Audience reach" },
    { value: "likes", label: "Likes", hint: "Audience response" },
    { value: "followers", label: "Followers", hint: "Audience growth" },
    { value: "custom", label: "Custom", hint: "Any creator outcome" },
  ],
};
type Runner = (key: string, action: (form: FormData) => Promise<ActionResult>, form: FormData, success?: () => void) => Promise<void>;

export function FocusAreaView({ data }: { data: FocusAreaData }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(new Set());
  const [finishingIds, setFinishingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(weekStart), index), "yyyy-MM-dd"));
  async function run(key: string, action: (form: FormData) => Promise<ActionResult>, form: FormData, success?: () => void) {
    setPending(key); setError(null);
    const result = await action(form);
    setPending(null);
    if (!result.ok) return setError(result.error);
    success?.(); router.refresh();
  }
  async function toggle(task: TodayTask) {
    const form = new FormData(); form.set("id", String(task.id));
    const completing = task.status !== "completed";
    setError(null);
    setPendingTaskIds((current) => new Set(current).add(task.id));
    if (completing) setFinishingIds((current) => new Set(current).add(task.id));
    const result = await toggleTask(form);
    if (!result.ok) {
      setError(result.error);
      setPendingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
      setFinishingIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
      return;
    }
    if (completing) await new Promise((resolve) => window.setTimeout(resolve, 620));
    setPendingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    setFinishingIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    router.refresh();
  }
  const title = data.category === "career" ? "Career" : "Content";
  return <div className="focus-area-shell mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">Focused workspace</p><h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.055em] sm:text-[2.6rem]">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Actions planned in This Week, with finished work kept close for perspective.</p></div><button onClick={() => setComposer(true)} className="premium-primary-button"><Plus size={16} /> Add task</button></header>
    {error && <div role="alert" className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">{error}<button onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button></div>}
    {composer && <TaskComposer weekStart={weekStart} days={weekDays} defaultCategory={data.category} lockCategory pending={pending === "create-task"} onSubmit={(form) => run("create-task", createTask, form, () => setComposer(false))} onClose={() => setComposer(false)} />}
    <MilestonesPanel category={data.category} milestones={data.milestones} pending={pending} run={run} />
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <TaskSection title="Active" subtitle="Work still in motion" tasks={data.active} pendingIds={pendingTaskIds} finishingIds={finishingIds} onToggle={toggle} />
      <TaskSection title="Completed" subtitle="Your finished work stays visible" tasks={data.completed} completed pendingIds={pendingTaskIds} finishingIds={finishingIds} onToggle={toggle} />
    </div>
  </div>;
}

function TaskSection({ title, subtitle, tasks, completed = false, pendingIds, finishingIds, onToggle }: { title: string; subtitle: string; tasks: TodayTask[]; completed?: boolean; pendingIds: Set<number>; finishingIds: Set<number>; onToggle: (task: TodayTask) => Promise<void> }) {
  return <section className="glass-panel overflow-hidden rounded-[28px]"><div className="focus-card-heading"><div><p className="dashboard-eyebrow">{title}</p><p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p></div><span className="focus-count">{tasks.length}</span></div><div className="border-t border-border p-3 sm:p-4">{tasks.length ? <div className="space-y-1">{tasks.map((task) => <TaskRow key={task.id} task={task} completed={completed} pending={pendingIds.has(task.id)} finishing={finishingIds.has(task.id)} onToggle={() => onToggle(task)} />)}</div> : <EmptyTasks completed={completed} />}</div></section>;
}

function TaskRow({ task, completed, pending, finishing, onToggle }: { task: TodayTask; completed: boolean; pending: boolean; finishing: boolean; onToggle: () => void }) {
  const date = completed && task.completedAt ? format(new Date(task.completedAt), "MMM d, yyyy") : task.anytimeWeekStart ? `Week of ${format(parseISO(task.anytimeWeekStart), "MMM d")}` : format(parseISO(task.date), "MMM d, yyyy");
  return <article className={`focus-task-row group ${completed ? "focus-task-completed" : ""} ${finishing ? "focus-task-finishing" : ""}`}><button type="button" onClick={onToggle} disabled={pending} className={completed ? "focus-reopen-button" : `task-check ${finishing ? "completion-check-bloom" : ""}`} aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{completed ? <RotateCcw size={13} /> : finishing ? <Check size={13} strokeWidth={3} /> : null}</button><div className="min-w-0 flex-1"><p className={`text-sm font-medium leading-5 ${completed || finishing ? "text-muted-foreground line-through decoration-[var(--orange)]/45" : ""}`}>{task.title}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{date}</span>{task.estimatedMinutes ? <><span>·</span><Clock3 size={11} /> {task.estimatedMinutes} min</> : null}<span>·</span><span>{finishing ? "Completed" : statusLabels[task.status]}</span></p></div></article>;
}

function EmptyTasks({ completed }: { completed: boolean }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">{completed ? <Check size={18} /> : <Clock3 size={18} />}</span><p className="mt-3 font-semibold">{completed ? "No completed work yet." : "Nothing active here."}</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{completed ? "Completed tasks will stay available here." : "Use Add task above when there is a clear next action."}</p></div>;
}

function MilestonesPanel({ category, milestones, pending, run }: { category: FocusArea; milestones: FocusAreaData["milestones"]; pending: string | null; run: Runner }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const all = [...milestones.active, ...milestones.achieved];
  const areaLabel = category === "career" ? "Career" : "Content";
  return <section className="glass-panel overflow-visible rounded-[28px]"><div className="focus-card-heading milestone-heading"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><Flag size={18} /></span><div><p className="dashboard-eyebrow">{areaLabel} milestones</p><p className="mt-1 text-sm text-muted-foreground">Outcomes worth remembering, separate from task progress.</p></div></div><button onClick={() => setAdding(true)} className="focus-add-button"><Plus size={14} /> Add milestone</button></div>{adding && <MilestoneForm category={category} submitLabel="Add milestone" pending={pending === "milestone-new"} onCancel={() => setAdding(false)} action={(form) => run("milestone-new", createMilestone, form, () => setAdding(false))} />}<div className="milestone-list border-t border-border p-3 sm:p-4">{all.length ? <div className="grid gap-2 sm:grid-cols-2">{all.map((milestone) => editing === milestone.id ? <MilestoneForm key={milestone.id} category={category} milestone={milestone} submitLabel="Save" pending={pending === `milestone-${milestone.id}`} onCancel={() => setEditing(null)} action={(form) => run(`milestone-${milestone.id}`, updateMilestone, form, () => setEditing(null))} /> : <MilestoneRow key={milestone.id} category={category} milestone={milestone} pending={pending === `milestone-${milestone.id}`} confirming={confirmDelete === milestone.id} onToggle={(form) => run(`milestone-${milestone.id}`, toggleMilestone, form)} onEdit={() => setEditing(milestone.id)} onConfirmDelete={() => setConfirmDelete(milestone.id)} onCancelDelete={() => setConfirmDelete(null)} onDelete={(form) => run(`milestone-${milestone.id}`, deleteMilestone, form, () => setConfirmDelete(null))} />)}</div> : <div className="py-8 text-center"><p className="text-sm font-semibold">No milestones yet.</p><p className="mt-1 text-xs text-muted-foreground">Add a meaningful {category === "career" ? "career" : "creator"} outcome when you have one.</p></div>}</div></section>;
}

function MilestoneForm({ category, milestone, submitLabel, pending, onCancel, action }: { category: FocusArea; milestone?: FocusMilestone; submitLabel: string; pending: boolean; onCancel: () => void; action: (form: FormData) => Promise<void> }) {
  const fallbackType = category === "career" ? "custom" : "custom";
  return <form action={action} className="milestone-form">{milestone && <input type="hidden" name="id" value={milestone.id} />}<input type="hidden" name="category" value={category} /><input autoFocus name="label" defaultValue={milestone?.label} maxLength={160} placeholder={category === "career" ? "Land the first interview" : "First video over 100K views"} className="focus-input sm:col-span-2" /><ThemedSelect name="type" initialValue={milestone?.type ?? fallbackType} options={milestoneTypeOptions[category]} /><input name="targetValue" type="number" min="1" max="1000000000" defaultValue={milestone?.targetValue ?? ""} placeholder="Optional target" className="focus-input" /><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={onCancel} className="thought-quiet-button">Cancel</button><button disabled={pending} className="premium-small-button">{pending ? "Saving…" : submitLabel}</button></div></form>;
}

function MilestoneRow({ category, milestone, pending, confirming, onToggle, onEdit, onConfirmDelete, onCancelDelete, onDelete }: { category: FocusArea; milestone: FocusMilestone; pending: boolean; confirming: boolean; onToggle: (form: FormData) => Promise<void>; onEdit: () => void; onConfirmDelete: () => void; onCancelDelete: () => void; onDelete: (form: FormData) => Promise<void> }) {
  const achieved = Boolean(milestone.achievedAt);
  const [celebrating, setCelebrating] = useState(false);
  async function handleToggle(form: FormData) {
    if (!achieved) {
      setCelebrating(true);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    await onToggle(form);
    if (!achieved) window.setTimeout(() => setCelebrating(false), 700);
  }
  return <article className={`milestone-row ${achieved ? "milestone-achieved" : ""} ${celebrating ? "milestone-celebrating" : ""}`}><form action={handleToggle}><input type="hidden" name="id" value={milestone.id} /><input type="hidden" name="category" value={category} /><input type="hidden" name="achieved" value={String(!achieved)} /><button disabled={pending || celebrating} className={`milestone-check ${celebrating ? "completion-check-bloom" : ""}`} aria-label={achieved ? `Reopen ${milestone.label}` : `Mark ${milestone.label} achieved`}>{(achieved || celebrating) && <Check size={13} strokeWidth={3} />}</button></form><div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${achieved || celebrating ? "text-muted-foreground line-through" : ""}`}>{milestone.label}</p><p className="mt-1 text-[10px] text-muted-foreground">{milestone.targetValue ? `${milestone.targetValue.toLocaleString()} ${milestoneTypeLabels[milestone.type].toLowerCase()}` : milestoneTypeLabels[milestone.type]}{milestone.achievedAt ? ` · Achieved ${format(new Date(milestone.achievedAt), "MMM d, yyyy")}` : celebrating ? " · Milestone achieved" : ""}</p></div><div className="flex items-center">{confirming ? <><span className="mr-1 text-[10px] text-muted-foreground">Delete?</span><form action={onDelete}><input type="hidden" name="id" value={milestone.id} /><input type="hidden" name="category" value={category} /><button disabled={pending} className="milestone-icon-button text-rose-700" aria-label="Confirm delete"><Check size={14} /></button></form><button type="button" onClick={onCancelDelete} className="milestone-icon-button" aria-label="Cancel delete"><X size={14} /></button></> : <><button type="button" onClick={onEdit} className="milestone-icon-button" aria-label={`Edit ${milestone.label}`}><Pencil size={13} /></button><button type="button" onClick={onConfirmDelete} className="milestone-icon-button hover:text-rose-700" aria-label={`Delete ${milestone.label}`}><Trash2 size={13} /></button></>}</div></article>;
}

function ThemedSelect({ name, initialValue, options }: { name: string; initialValue: FocusMilestone["type"]; options: Array<{ value: FocusMilestone["type"]; label: string; hint: string }> }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options.at(-1)!;
  useEffect(() => {
    function close(event: MouseEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);
  return <div ref={root} className="themed-select"><input type="hidden" name={name} value={value} /><button type="button" className="themed-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span><strong>{selected.label}</strong><small>{selected.hint}</small></span><ChevronDown size={15} className={open ? "rotate-180" : ""} /></button>{open && <div role="listbox" aria-label="Milestone type" className="themed-select-menu">{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className="themed-select-option" onClick={() => { setValue(option.value); setOpen(false); }}><span><strong>{option.label}</strong><small>{option.hint}</small></span>{option.value === value && <Check size={14} />}</button>)}</div>}</div>;
}
