"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Check, ChevronDown, Clock3, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { addDays, format, isToday, parseISO } from "date-fns";
import { createTask, deleteTask, moveTaskToTomorrow, reorderTask, saveDailyFocus, toggleTask, updateTask, type ActionResult } from "@/src/app/today/actions";
import type { TodayData, TodayTask, TaskCategory, TaskPriority } from "@/src/lib/today";

const categoryLabels: Record<TaskCategory, string> = { career: "Career", content: "Content", other: "Other" };
const priorityLabels: Record<TaskPriority, string> = { high: "High", normal: "Normal", low: "Low" };
const categories: TaskCategory[] = ["career", "content", "other"];
const inputClass = "w-full rounded-xl border border-border bg-background/65 px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/15";
const quietButton = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-3.5 text-sm text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function TodayView({ data }: { data: TodayData }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedDate = parseISO(data.date);
  const previousDate = format(addDays(selectedDate, -1), "yyyy-MM-dd");
  const nextDate = format(addDays(selectedDate, 1), "yyyy-MM-dd");
  const progress = data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100);
  const hasFocus = Boolean(data.focus?.careerMission || data.focus?.contentMission);

  async function runAction(key: string, action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onSuccess?: () => void) {
    setPending(key);
    setMessage(null);
    const result = await action(formData);
    setPending(null);
    if (!result.ok) return setMessage(result.error);
    onSuccess?.();
  }

  const visibleCategories = data.tasks.length === 0 ? ["career"] as TaskCategory[] : categories.filter((category) => data.categories[category].total > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{format(selectedDate, "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/today?date=${previousDate}`} className={quietButton} aria-label="Previous day"><ArrowLeft size={16} /></Link>
          <Link href={`/today?date=${data.date}`} className={`${quietButton} ${isToday(selectedDate) ? "border-[var(--orange)] bg-[var(--orange)] text-white hover:bg-[var(--orange)] hover:text-white" : ""}`}><CalendarDays size={15} /> Today</Link>
          <Link href={`/today?date=${nextDate}`} className={quietButton} aria-label="Next day"><ArrowRight size={16} /></Link>
        </div>
      </header>

      {message && <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"><span>{message}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X size={15} /></button></div>}

      <section className="overflow-hidden rounded-[26px] border border-border bg-card p-4 shadow-[0_18px_48px_rgba(70,58,42,0.07)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">{data.completed}/{data.total}</div><div><h2 className="font-semibold tracking-[-0.02em]">Today’s checklist</h2><p className="text-xs text-muted-foreground">{data.total === 0 ? "Start with one useful action." : `${data.completed} complete · ${data.total - data.completed} left`}</p></div></div>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--orange)] px-4 text-sm font-medium text-white shadow-[0_8px_18px_rgba(190,82,37,0.22)] transition hover:brightness-95"><Plus size={16} /> Add task</button>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[var(--orange)] transition-[width]" style={{ width: `${progress}%` }} /></div>

        {showCreate && <TaskForm date={data.date} pending={pending === "create"} onSubmit={(formData) => runAction("create", createTask, formData, () => setShowCreate(false))} onCancel={data.tasks.length > 0 ? () => setShowCreate(false) : undefined} submitLabel="Add task" />}

        <div className="mt-5 space-y-5">
          {visibleCategories.map((category) => <CategorySection key={category} category={category} tasks={data.tasks.filter((task) => task.category === category)} completed={data.categories[category].completed} total={data.categories[category].total} editingId={editingId} setEditingId={setEditingId} pending={pending} runAction={runAction} />)}
        </div>
      </section>

      <details className="group overflow-hidden rounded-[22px] border border-border bg-card/75 shadow-sm backdrop-blur-xl" open={hasFocus}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold"><span>Daily focus <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span></span><ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" /></summary>
        <form className="grid gap-3 border-t border-border p-4 sm:grid-cols-2" action={(formData) => runAction("focus", saveDailyFocus, formData)}>
          <input type="hidden" name="date" value={data.date} />
          <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Career focus</span><textarea name="careerMission" defaultValue={data.focus?.careerMission ?? ""} rows={2} placeholder="What would make career progress today?" className={inputClass} /></label>
          <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Content focus</span><textarea name="contentMission" defaultValue={data.focus?.contentMission ?? ""} rows={2} placeholder="What would make content progress today?" className={inputClass} /></label>
          <div className="sm:col-span-2"><button type="submit" className={quietButton} disabled={pending === "focus"}>{pending === "focus" ? "Saving…" : "Save focus"}</button></div>
        </form>
      </details>
    </div>
  );
}

function CategorySection({ category, tasks, completed, total, editingId, setEditingId, pending, runAction }: { category: TaskCategory; tasks: TodayTask[]; completed: number; total: number; editingId: number | null; setEditingId: (id: number | null) => void; pending: string | null; runAction: (key: string, action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onSuccess?: () => void) => Promise<void> }) {
  return <section>
    <div className="mb-2.5 flex items-center gap-2"><h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{categoryLabels[category]}</h3>{total > 0 && <span className="text-xs text-muted-foreground">{completed}/{total}</span>}</div>
    {tasks.length === 0 ? <p className="rounded-xl bg-muted/65 px-3.5 py-3 text-sm text-muted-foreground">No tasks yet. Add the next concrete action.</p> : <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background/30">{tasks.map((task, index) => <TaskItem key={task.id} task={task} index={index} last={tasks.length - 1} editing={editingId === task.id} setEditingId={setEditingId} pending={pending} runAction={runAction} />)}</div>}
  </section>;
}

function TaskItem({ task, index, last, editing, setEditingId, pending, runAction }: { task: TodayTask; index: number; last: number; editing: boolean; setEditingId: (id: number | null) => void; pending: string | null; runAction: (key: string, action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onSuccess?: () => void) => Promise<void> }) {
  const taskPending = pending?.endsWith(`-${task.id}`) ?? false;
  return <article className={task.status === "completed" ? "bg-muted/35" : "bg-card/40"}>
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
      <form action={(formData) => runAction(`toggle-${task.id}`, toggleTask, formData)}><input type="hidden" name="id" value={task.id} /><button type="submit" aria-label={task.status === "completed" ? `Undo ${task.title}` : `Complete ${task.title}`} disabled={taskPending} className={`grid size-5 shrink-0 place-items-center rounded-full border transition ${task.status === "completed" ? "border-[var(--orange)] bg-[var(--orange)] text-white" : "border-muted-foreground/50 hover:border-[var(--orange)]"}`}>{task.status === "completed" && <Check size={12} strokeWidth={3} />}</button></form>
      <div className="min-w-0 flex-1"><p className={`truncate text-sm ${task.status === "completed" ? "text-muted-foreground line-through" : "font-medium"}`}>{task.title}</p><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">{task.priority === "high" && <span className="font-medium text-rose-700 dark:text-rose-300">High</span>}{task.priority === "low" && <span>Low</span>}{task.estimatedMinutes && <span className="inline-flex items-center gap-1"><Clock3 size={12} />{task.estimatedMinutes} min</span>}</div></div>
      <div className="flex shrink-0 items-center"><form action={(formData) => runAction(`move-${task.id}`, moveTaskToTomorrow, formData)}><input type="hidden" name="id" value={task.id} /><button type="submit" disabled={task.status === "completed" || taskPending} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Move to tomorrow" title="Move to tomorrow"><ArrowRight size={15} /></button></form><button type="button" onClick={() => setEditingId(editing ? null : task.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Task options"><MoreHorizontal size={16} /></button></div>
    </div>
    {editing && <div className="border-t border-border bg-muted/30 px-3 py-3"><TaskForm task={task} date={task.date} pending={pending === `update-${task.id}`} onSubmit={(formData) => runAction(`update-${task.id}`, updateTask, formData, () => setEditingId(null))} onCancel={() => setEditingId(null)} submitLabel="Save" /><div className="mt-3 flex items-center justify-between"><div className="flex gap-1">{index > 0 && <ReorderButton task={task} direction="up" pending={taskPending} runAction={runAction}><ArrowUp size={14} /></ReorderButton>}{index < last && <ReorderButton task={task} direction="down" pending={taskPending} runAction={runAction}><ArrowDown size={14} /></ReorderButton>}</div><form action={(formData) => { if (window.confirm("Delete this task?")) return runAction(`delete-${task.id}`, deleteTask, formData, () => setEditingId(null)); return Promise.resolve(); }}><input type="hidden" name="id" value={task.id} /><button type="submit" className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:underline dark:text-rose-300"><Trash2 size={13} />Delete</button></form></div></div>}
  </article>;
}

function ReorderButton({ task, direction, pending, runAction, children }: { task: TodayTask; direction: "up" | "down"; pending: boolean; runAction: (key: string, action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onSuccess?: () => void) => Promise<void>; children: React.ReactNode }) {
  return <form action={(formData) => runAction(`${direction}-${task.id}`, reorderTask, formData)}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="date" value={task.date} /><input type="hidden" name="category" value={task.category} /><input type="hidden" name="direction" value={direction} /><button type="submit" disabled={pending} className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Move ${direction}`}>{children}</button></form>;
}

function TaskForm({ date, task, pending, onSubmit, onCancel, submitLabel }: { date: string; task?: TodayTask; pending: boolean; onSubmit: (formData: FormData) => Promise<void>; onCancel?: () => void; submitLabel: string }) {
  return <form className="mt-4 rounded-2xl bg-muted/55 p-3.5" action={onSubmit}>
    {task && <input type="hidden" name="id" value={task.id} />}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_130px_130px]">
      <label className="space-y-1.5 lg:col-span-1"><span className="text-xs font-medium text-muted-foreground">Task</span><input name="title" defaultValue={task?.title ?? ""} className={inputClass} placeholder="e.g. Review the match dataset" autoFocus={!task} required /></label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Category</span><select name="category" defaultValue={task?.category ?? "career"} className={inputClass}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Priority</span><select name="priority" defaultValue={task?.priority ?? "normal"} className={inputClass}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Date</span><input type="date" name="date" defaultValue={task?.date ?? date} className={inputClass} required /></label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Minutes</span><input type="number" name="estimatedMinutes" defaultValue={task?.estimatedMinutes ?? ""} min="1" max="1440" className={inputClass} placeholder="Optional" /></label>
      <label className="space-y-1.5 sm:col-span-2 lg:col-span-3"><span className="text-xs font-medium text-muted-foreground">Notes <span className="font-normal">(optional)</span></span><textarea name="description" defaultValue={task?.description ?? ""} rows={2} className={inputClass} placeholder="A small note about what done looks like" /></label>
    </div>
    <div className="mt-3 flex justify-end gap-2"><button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-xl bg-[var(--orange)] px-4 text-sm font-medium text-white shadow-sm transition hover:brightness-95 disabled:opacity-50">{pending ? "Saving…" : submitLabel}</button>{onCancel && <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>}</div>
  </form>;
}
