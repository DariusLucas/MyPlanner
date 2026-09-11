"use client";

import Link from "next/link";
import {
  createContext,
  type DragEvent as ReactDragEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addWeeks,
  format,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  CalendarPlus2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import {
  confirmTaskCompletion,
  createTask,
  deleteTask,
  setTaskWorkflow,
  toggleTask,
  updateTask,
  type ActionResult,
} from "@/src/app/today/actions";
import type { PlannerId, TaskCategory, TaskStatus } from "@/src/lib/today";
import type { WeekData, WeekTask, WeeklyRecurrence } from "@/src/lib/week";
import { TaskCompletionButton, useDialogContract } from "@/src/components/interaction-primitives";
import { COMPLETION_FEEDBACK_MS, DIALOG_EXIT_MS } from "@/src/lib/interaction";

const categories: TaskCategory[] = ["career", "content", "other"];
const categoryLabels: Record<TaskCategory, string> = {
  career: "Career",
  content: "Content",
  other: "Personal",
};
const workflow: { status: TaskStatus; label: string }[] = [
  { status: "not_started", label: "Upcoming" },
  { status: "in_progress", label: "Doing" },
  { status: "on_hold", label: "On Hold" },
  { status: "done", label: "Done" },
];
const inputClass =
  "w-full rounded-xl border border-border bg-background/65 px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/15";
const quietButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-3.5 text-sm text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground";
type Runner = (
  key: string,
  action: (form: FormData) => Promise<ActionResult>,
  form: FormData,
  success?: () => void,
) => Promise<void>;
type OptimisticCompletions = Record<string, boolean>;
type AnytimeProgress = { completed: number; total: number; value: number };
type WeekProgress = AnytimeProgress & { remaining: number };
type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const ConfirmDialogContext = createContext<
  (request: ConfirmationRequest) => void
>(() => undefined);

function getAnytimeProgress(
  data: WeekData,
  optimisticCompletions: OptimisticCompletions,
): AnytimeProgress {
  const normalTasks = new Map<PlannerId, WeekTask>();
  [...data.anytime, ...data.completed]
    .filter(
      (task) => task.anytimeWeekStart === data.weekStart && !task.recurrenceId,
    )
    .forEach((task) => {
      const existing = normalTasks.get(task.id);
      if (!existing || task.status === "completed")
        normalTasks.set(task.id, task);
    });
  const normal = [...normalTasks.values()];
  const normalCompleted = normal.filter(
    (task) => optimisticCompletions[task.id] ?? task.status === "completed",
  ).length;
  const routineTotal = data.recurringAnytime.reduce(
    (sum, recurrence) => sum + recurrence.countPerWeek,
    0,
  );
  const routineCompleted = data.recurringAnytime.reduce(
    (sum, recurrence) =>
      sum +
      recurrence.tasks.filter(
        (task) => optimisticCompletions[task.id] ?? task.status === "completed",
      ).length,
    0,
  );
  const total = normal.length + routineTotal;
  const completed = Math.min(total, normalCompleted + routineCompleted);
  return {
    completed,
    total,
    value: total ? Math.round((completed / total) * 100) : 0,
  };
}

function getWeekProgress(
  data: WeekData,
  optimisticCompletions: OptimisticCompletions,
): WeekProgress {
  const visibleTasks = new Map<PlannerId, WeekTask>();
  [
    ...data.overdue,
    ...data.days.flatMap((day) => day.tasks),
    ...data.anytime,
    ...data.recurringAnytime.flatMap((recurrence) =>
      recurrence.tasks.slice(0, recurrence.countPerWeek),
    ),
  ].forEach((task) => visibleTasks.set(task.id, task));
  const tasks = [...visibleTasks.values()];
  const completed = tasks.filter(
    (task) => optimisticCompletions[task.id] ?? task.status === "completed",
  ).length;
  const total = tasks.length;
  return {
    completed,
    total,
    remaining: total - completed,
    value: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function WeekView({ data }: { data: WeekData }) {
  const [view, setView] = useState<"checklist" | "board">("checklist");
  const [selectedDate, setSelectedDate] = useState(
    data.days.find((day) => isToday(parseISO(day.date)))?.date ??
      data.days[0]?.date ??
      data.weekStart,
  );
  const [composer, setComposer] = useState(false);
  const [editing, setEditing] = useState<PlannerId | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [optimisticCompletions, setOptimisticCompletions] =
    useState<OptimisticCompletions>({});
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(
    null,
  );
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const currentStart = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const nextStart = format(addWeeks(parseISO(currentStart), 1), "yyyy-MM-dd");
  const thisWeek = data.weekStart === currentStart;
  const nextWeek = data.weekStart === nextStart;
  const active = useMemo(
    () =>
      [...data.overdue, ...data.days.flatMap((day) => day.tasks)].filter(
        (task) => task.status !== "completed",
      ),
    [data],
  );
  const anytimeProgress = getAnytimeProgress(data, optimisticCompletions);
  const weekProgress = getWeekProgress(data, optimisticCompletions);

  useEffect(() => {
    setSelectedDate((current) =>
      data.days.some((day) => day.date === current)
        ? current
        : data.days.find((day) => isToday(parseISO(day.date)))?.date ??
          data.days[0]?.date ??
          data.weekStart,
    );
  }, [data.weekStart, data.days]);

  function setOptimisticCompletion(id: PlannerId, completed: boolean) {
    setOptimisticCompletions((current) => ({ ...current, [id]: completed }));
  }

  function requestConfirmation(request: ConfirmationRequest) {
    setConfirmationClosing(false);
    setConfirmation(request);
  }

  function dismissConfirmation() {
    setConfirmationClosing(true);
    window.setTimeout(() => {
      setConfirmation(null);
      setConfirmationClosing(false);
    }, DIALOG_EXIT_MS);
  }

  async function approveConfirmation() {
    if (!confirmation) return;
    setConfirming(true);
    await confirmation.action();
    setConfirming(false);
    dismissConfirmation();
  }

  async function run(
    key: string,
    action: (form: FormData) => Promise<ActionResult>,
    form: FormData,
    success?: () => void,
  ) {
    setPending(key);
    setMessage(null);
    const result = await action(form);
    setPending(null);
    if (result.ok) {
      success?.();
      return;
    }
    setMessage(result.error);
  }

  return (
    <ConfirmDialogContext.Provider value={requestConfirmation}>
      <div className="week-page-shell mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {format(parseISO(data.weekStart), "MMMM d")} –{" "}
              {format(parseISO(data.weekEnd), "MMMM d, yyyy")}
            </p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-[-.055em] sm:text-[2.6rem]">
              {thisWeek ? "This Week" : nextWeek ? "Next Week" : "Week plan"}
            </h1>
            <p className="week-progress-summary" aria-live="polite">
              {weekProgress.total ? (
                <>
                  <strong>{weekProgress.remaining} left</strong>
                  <span aria-hidden="true"> · </span>
                  {weekProgress.completed} done
                  <span aria-hidden="true"> · </span>
                  {weekProgress.total} planned
                </>
              ) : (
                "Nothing planned yet. Add your first task when you are ready."
              )}
            </p>
          </div>
          <div className="week-header-actions flex flex-wrap items-center gap-1.5">
            {thisWeek && (
              <Link
                href={`/week?week=${nextStart}`}
                className="week-plan-next-button"
              >
                <CalendarPlus2 size={16} />
                Plan next week
                <ChevronRight size={15} />
              </Link>
            )}
            <button
              onClick={() => setComposer(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--orange)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(190,82,37,.22)]"
            >
              <Plus size={16} /> Add task
            </button>
            <Link
              href={`/week?week=${format(addWeeks(parseISO(data.weekStart), -1), "yyyy-MM-dd")}`}
              className={quietButton}
            >
              <ChevronLeft size={16} />
            </Link>
            <Link
              href="/week"
              className={`${quietButton} ${thisWeek ? "week-current-button" : ""}`}
            >
              <CalendarDays size={15} /> This week
            </Link>
            <Link
              href={`/week?week=${format(addWeeks(parseISO(data.weekStart), 1), "yyyy-MM-dd")}`}
              className={quietButton}
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        </header>
        {composer && (
          <TaskComposer
            weekStart={data.weekStart}
            days={data.days.map((day) => day.date)}
            pending={pending === "create"}
            onSubmit={async (form) => {
              let created = false;
              await run("create", createTask, form, () => { created = true; });
              return created;
            }}
            onClose={() => setComposer(false)}
          />
        )}
        {message && (
          <div
            role="status"
            className="flex justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800"
          >
            <span>{message}</span>
            <button onClick={() => setMessage(null)}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="week-view-picker">
          <div className="flex w-fit gap-1 rounded-xl border border-border bg-card/70 p-1" role="group" aria-label="Week view">
            <button
              type="button"
              aria-pressed={view === "checklist"}
              onClick={() => setView("checklist")}
              className={`week-view-toggle rounded-lg px-3 py-1.5 text-sm ${view === "checklist" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}
            >
              Checklist
            </button>
            <button
              type="button"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
              className={`week-view-toggle rounded-lg px-3 py-1.5 text-sm ${view === "board" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}
            >
              Kanban
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {view === "checklist"
              ? "Simple view: see what is left and check off what you finish."
              : "Optional workflow view: move scheduled tasks through stages."}
          </p>
        </div>
        <div key={view} className="week-view-switch">
          {view === "checklist" ? (
            <Checklist
              data={data}
              editing={editing}
              setEditing={setEditing}
              pending={pending}
              run={run}
              anytimeProgress={anytimeProgress}
              optimisticCompletions={optimisticCompletions}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onCompletionChange={setOptimisticCompletion}
            />
          ) : (
            <Board
              tasks={active}
              weekStart={data.weekStart}
              anytime={data.anytime}
              recurringAnytime={data.recurringAnytime}
              editing={editing}
              setEditing={setEditing}
              pending={pending}
              run={run}
              anytimeProgress={anytimeProgress}
              onCompletionChange={setOptimisticCompletion}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        request={confirmation}
        closing={confirmationClosing}
        pending={confirming}
        onCancel={dismissConfirmation}
        onConfirm={approveConfirmation}
      />
    </ConfirmDialogContext.Provider>
  );
}

function ConfirmDialog({
  request,
  closing,
  pending,
  onCancel,
  onConfirm,
}: {
  request: ConfirmationRequest | null;
  closing: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useDialogContract<HTMLElement>({
    active: Boolean(request),
    blocked: pending,
    onClose: onCancel,
  });

  useEffect(() => setMounted(true), []);
  if (!mounted || !request) return null;

  return createPortal(
    <div
      className={`modal-backdrop ${closing ? "modal-closing" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <p className="confirm-dialog-kicker">Please confirm</p>
        <h2 id="confirm-dialog-title" className="mt-1 text-lg font-semibold">
          {request.title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          {request.description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            className={quietButton}
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className="rounded-xl bg-[var(--orange)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(190,82,37,.22)]"
          >
            {pending ? "Deleting…" : request.confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function TaskComposer({
  weekStart,
  days,
  pending,
  onSubmit,
  onClose,
  defaultCategory = "career",
  lockCategory = false,
}: {
  weekStart: string;
  days: string[];
  pending: boolean;
  onSubmit: (form: FormData) => Promise<boolean>;
  onClose: () => void;
  defaultCategory?: TaskCategory;
  lockCategory?: boolean;
}) {
  const [placement, setPlacement] = useState(`anytime:${weekStart}`);
  const [category, setCategory] = useState<TaskCategory>(defaultCategory);
  const [recurrenceCount, setRecurrenceCount] = useState("0");
  const [showRoutine, setShowRoutine] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anytime = placement.startsWith("anytime:");
  const dialogRef = useDialogContract<HTMLFormElement>({
    blocked: pending || closing,
    lockScroll: false,
    onClose: close,
  });

  useEffect(() => {
    setMounted(true);
    const scrollY = window.scrollY;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0)
      document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  function close() {
    if (closing || pending) return;
    setClosing(true);
    setTimeout(onClose, DIALOG_EXIT_MS);
  }
  async function submit(form: FormData) {
    const created = await onSubmit(form);
    if (created) close();
  }
  if (!mounted) return null;

  return createPortal(
    <div
      className={`modal-backdrop ${closing ? "modal-closing" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        action={submit}
        className="task-composer"
        aria-busy={pending}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
        aria-describedby="add-task-description"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="add-task-title" className="font-semibold">
              Add a task
            </h2>
            <p id="add-task-description" className="text-xs text-muted-foreground">
              Choose a day, or keep it flexible for this week.
            </p>
          </div>
          <button type="button" onClick={close} disabled={pending} aria-label="Close add task">
            <X size={16} />
          </button>
        </div>
        {pending && <div role="status" className="task-save-status"><LoaderCircle size={14} className="animate-spin" /> Saving your task…</div>}
        <input
          name="title"
          className={`${inputClass} mt-4`}
          placeholder="What needs doing?"
          autoFocus
          required
        />
        <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
          When
        </p>
        <div className="choice-grid">
          <button
            type="button"
            onClick={() => setPlacement(`anytime:${weekStart}`)}
            className={
              anytime ? "choice-chip choice-chip-active" : "choice-chip"
            }
          >
            Anytime
          </button>
          {days.map((date) => (
            <button
              type="button"
              key={date}
              onClick={() => {
                setPlacement(date);
                setRecurrenceCount("0");
                setShowRoutine(false);
              }}
              className={
                placement === date
                  ? "choice-chip choice-chip-active"
                  : "choice-chip"
              }
            >
              {format(parseISO(date), "EEE d")}
            </button>
          ))}
        </div>
        {anytime && (
          <div className="mt-4">
            {!showRoutine ? (
              <button
                type="button"
                aria-expanded="false"
                onClick={() => {
                  setShowRoutine(true);
                  setRecurrenceCount("1");
                }}
                className="routine-disclosure-button"
              >
                <CalendarDays size={15} /> Make this a weekly routine
              </button>
            ) : (
              <div className="routine-target-panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
                      Weekly routine
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Choose your check-ins for each week. The target resets every Monday.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRoutine(false);
                      setRecurrenceCount("0");
                    }}
                    className="routine-one-off-button"
                  >
                    Keep one-off
                  </button>
                </div>
                <div className="choice-grid mt-2" aria-label="Weekly check-in target">
                  {Array.from({ length: 7 }, (_, index) => index + 1).map(
                    (count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setRecurrenceCount(String(count))}
                        className={
                          recurrenceCount === String(count)
                            ? "choice-chip choice-chip-active"
                            : "choice-chip"
                        }
                      >
                        {count} {count === 1 ? "check-in" : "check-ins"}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {lockCategory ? (
          <p className="mt-4 rounded-xl border border-border bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground">
            Adding to <span className="font-semibold text-foreground">{categoryLabels[category]}</span>
          </p>
        ) : <><p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
          Category
        </p>
        <div className="choice-grid choice-grid-compact">
          {categories.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setCategory(value)}
              className={
                category === value
                  ? "choice-chip choice-chip-active"
                  : "choice-chip"
              }
            >
              {categoryLabels[value]}
            </button>
          ))}
        </div></>}
        <input
          type="hidden"
          name="date"
          value={anytime ? weekStart : placement}
        />
        <input
          type="hidden"
          name="anytimeWeekStart"
          value={anytime ? weekStart : ""}
        />
        <input
          type="hidden"
          name="recurrenceCount"
          value={anytime ? recurrenceCount : "0"}
        />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="priority" value="normal" />
        <input type="hidden" name="description" value="" />
        <input type="hidden" name="estimatedMinutes" value="" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={pending} className={quietButton} onClick={close}>
            Cancel
          </button>
          <button
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--orange)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {pending ? <><LoaderCircle size={14} className="animate-spin" /> Adding…</> : "Add task"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function InlineTaskComposer({
  date,
  pending,
  run,
}: {
  date: string;
  pending: string | null;
  run: Runner;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TaskCategory>("career");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const key = `quick-${date}`;
  const submitting = pending === key;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit(form: FormData) {
    let created = false;
    await run(key, createTask, form, () => {
      created = true;
    });
    if (!created) return;
    formRef.current?.reset();
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="week-inline-add-trigger"
      >
        <Plus size={14} /> Add task
      </button>
    );
  }

  return (
    <form ref={formRef} action={submit} className="week-inline-composer">
      <div className="week-inline-entry-row">
        <input
          ref={inputRef}
          name="title"
          className="week-inline-title"
          placeholder="Add a task…"
          aria-label={`Task title for ${format(parseISO(date), "EEEE")}`}
          required
          maxLength={200}
        />
        <button
          disabled={submitting}
          className="week-inline-submit"
          aria-label="Add task"
        >
          {submitting ? "Adding…" : <><Plus size={14} /> Add</>}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="week-inline-close"
          aria-label="Close inline task form"
        >
          <X size={15} />
        </button>
      </div>
      <div className="week-inline-categories" aria-label="Task category">
        {categories.map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setCategory(value)}
            aria-pressed={category === value}
            className={category === value ? "week-inline-category-active" : ""}
          >
            {categoryLabels[value]}
          </button>
        ))}
      </div>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="anytimeWeekStart" value="" />
      <input type="hidden" name="recurrenceCount" value="0" />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="priority" value="normal" />
      <input type="hidden" name="description" value="" />
      <input type="hidden" name="estimatedMinutes" value="" />
    </form>
  );
}

function Checklist({
  data,
  editing,
  setEditing,
  pending,
  run,
  anytimeProgress,
  optimisticCompletions,
  selectedDate,
  onSelectDate,
  onCompletionChange,
}: {
  data: WeekData;
  editing: PlannerId | null;
  setEditing: (value: PlannerId | null) => void;
  pending: string | null;
  run: Runner;
  anytimeProgress: AnytimeProgress;
  optimisticCompletions: OptimisticCompletions;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCompletionChange: (id: PlannerId, completed: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {data.overdue.length > 0 && (
        <section className="rounded-[22px] border border-amber-500/25 bg-card p-4">
          <h2 className="text-sm font-semibold">
            Overdue{" "}
            <span className="font-normal text-muted-foreground">
              — bring these forward
            </span>
          </h2>
          <div className="mt-3 space-y-2">
            {data.overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                overdue
                pending={pending}
                run={run}
                editing={editing === task.id}
                setEditing={setEditing}
                onCompletionChange={onCompletionChange}
              />
            ))}
          </div>
        </section>
      )}
      <section className="week-anytime-card">
        <div className="week-anytime-header flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Anytime this week</h2>
            <p className="text-xs text-muted-foreground">
              Flexible tasks and weekly routines can be done on any day.
            </p>
          </div>
          {anytimeProgress.total > 0 && <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {anytimeProgress.total - anytimeProgress.completed} left · {anytimeProgress.completed} done
              </span>
              <ProgressRing
                value={anytimeProgress.value}
                completed={anytimeProgress.completed}
                total={anytimeProgress.total}
              />
            </div>}
        </div>
        {data.recurringAnytime.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
              Weekly routines
            </p>
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              Each circle is one check-in. Every target starts fresh on Monday.
            </p>
            <div className="space-y-2">
              {data.recurringAnytime.map((recurrence) => (
                <RecurringTaskCard
                  key={recurrence.recurrenceId}
                  recurrence={recurrence}
                  pending={pending}
                  run={run}
                  editing={editing === recurrence.tasks[0]?.id}
                  setEditing={setEditing}
                  onCompletionChange={onCompletionChange}
                />
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 grid items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.anytime.length ? (
            data.anytime.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                pending={pending}
                run={run}
                editing={editing === task.id}
                setEditing={setEditing}
                onCompletionChange={onCompletionChange}
              />
            ))
          ) : data.recurringAnytime.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No flexible tasks or routines.
            </p>
          ) : null}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.days.map(({ date, tasks }, index) => (
          <DayCard
            key={date}
            date={date}
            tasks={tasks}
            glow={index % 2 === 0}
            sunday={index === 6}
            selected={selectedDate === date}
            onSelect={() => onSelectDate(date)}
            editing={editing}
            setEditing={setEditing}
            pending={pending}
            run={run}
            optimisticCompletions={optimisticCompletions}
            onCompletionChange={onCompletionChange}
          />
        ))}
      </div>
    </div>
  );
}
function RecurringTaskCard({
  recurrence,
  pending,
  run,
  editing,
  setEditing,
  onCompletionChange,
  kanban,
}: {
  recurrence: WeeklyRecurrence;
  pending: string | null;
  run: Runner;
  editing: boolean;
  setEditing: (value: PlannerId | null) => void;
  onCompletionChange?: (id: PlannerId, completed: boolean) => void;
  kanban?: boolean;
}) {
  const checkIns = recurrence.tasks.slice(0, recurrence.countPerWeek);
  const task = checkIns[0]!;
  const [visualStates, setVisualStates] = useState<Record<string, boolean>>({});
  const [celebratingId, setCelebratingId] = useState<PlannerId | null>(null);
  const completed = checkIns.filter(
    (instance) => visualStates[instance.id] ?? instance.status === "completed",
  ).length;
  const total = recurrence.countPerWeek;
  return (
    <article
      className={`week-task-card ${kanban ? "anytime-kanban-task-card" : ""} recurrence-task-card ${completed === total ? "week-task-completed" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{task.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Weekly routine · {completed} of {total} {total === 1 ? "check-in" : "check-ins"} done · resets every Monday
            {recurrence.missedLastWeek > 0 && (
              <> · {recurrence.missedLastWeek} missed last week</>
            )}
          </p>
          <div
            className="recurrence-checks"
            aria-label={`${task.title}: ${completed} of ${total} complete`}
          >
            {checkIns.map((instance, index) => {
              const instanceCompleted = visualStates[instance.id] ?? instance.status === "completed";
              return (
                <form
                  key={instance.id}
                  action={(form) => {
                    const nextCompleted = !instanceCompleted;
                    form.set("revision", String(instance.revision ?? 1));
                    form.set("completed", String(nextCompleted));
                    setVisualStates((current) => ({ ...current, [instance.id]: nextCompleted }));
                    if (nextCompleted) {
                      setCelebratingId(instance.id);
                      window.setTimeout(() => setCelebratingId((current) => current === instance.id ? null : current), COMPLETION_FEEDBACK_MS);
                    }
                    onCompletionChange?.(instance.id, !instanceCompleted);
                    return run(`toggle-${instance.id}`, toggleTask, form);
                  }}
                >
                  <input type="hidden" name="id" value={instance.id} />
                  <TaskCompletionButton
                    type="submit"
                    title={`check-in ${index + 1} for ${task.title}`}
                    completed={instanceCompleted}
                    pending={pending === `toggle-${instance.id}`}
                    animating={celebratingId === instance.id}
                    incompleteContent={index + 1}
                  />
                </form>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => setEditing(editing ? null : task.id)}
          className="week-task-menu-button text-muted-foreground"
          aria-label={`Edit ${task.title}`}
          aria-expanded={editing}
        >
          ...
        </button>
      </div>
      <EditForm
        task={task}
        open={editing}
        pending={pending === `update-${task.id}`}
        onSave={(form) =>
          run(`update-${task.id}`, updateTask, form, () => setEditing(null))
        }
        onDelete={(form) =>
          run(`delete-${task.id}`, deleteTask, form, () => setEditing(null))
        }
        onClose={() => setEditing(null)}
      />
    </article>
  );
}
function DayCard({
  date,
  tasks,
  glow,
  sunday,
  selected,
  onSelect,
  editing,
  setEditing,
  pending,
  run,
  optimisticCompletions,
  onCompletionChange,
}: {
  date: string;
  tasks: WeekTask[];
  glow: boolean;
  sunday: boolean;
  selected: boolean;
  onSelect: () => void;
  editing: PlannerId | null;
  setEditing: (value: PlannerId | null) => void;
  pending: string | null;
  run: Runner;
  optimisticCompletions: OptimisticCompletions;
  onCompletionChange: (id: PlannerId, completed: boolean) => void;
}) {
  const completed = tasks.filter(
    (task) => optimisticCompletions[task.id] ?? task.status === "completed",
  ).length;
  const remaining = tasks.length - completed;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  return (
    <section
      className={`week-day-card ${glow ? "week-glow-card" : ""} ${sunday ? "week-sunday-card" : ""} ${selected ? "week-day-card-selected" : ""} ${tasks.length === 0 ? "week-day-card-empty" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="week-day-select-button"
          aria-pressed={selected}
          aria-label={`${selected ? "Selected" : "Select"} ${format(parseISO(date), "EEEE, MMMM d")} for quick add`}
          onClick={onSelect}
        >
          <h2 className="text-lg font-semibold tracking-[-.03em]">
            {format(parseISO(date), "EEEE")}
            {isToday(parseISO(date)) && (
              <span className="ml-2 text-xs font-semibold text-[var(--orange)]">
                Today
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(date), "MMMM d")}
            {sunday && " · a softer landing"}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {tasks.length ? `${remaining} left · ${completed} done` : selected ? "Selected for quick add" : "No tasks"}
          </p>
        </button>
        {tasks.length > 0 && <ProgressRing
            value={progress}
            completed={completed}
            total={tasks.length}
          />}
      </div>
      <div
        className={`mt-4 space-y-2 ${sunday ? "xl:grid xl:grid-cols-2 xl:gap-2 xl:space-y-0" : ""}`}
      >
        {tasks.length ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              pending={pending}
              run={run}
              editing={editing === task.id}
              setEditing={setEditing}
              onCompletionChange={onCompletionChange}
            />
          ))
        ) : null}
      </div>
      {selected && (
        <InlineTaskComposer
          date={date}
          pending={pending}
          run={run}
        />
      )}
    </section>
  );
}
function ProgressRing({
  value,
  completed,
  total,
}: {
  value: number;
  completed: number;
  total: number;
}) {
  const [progress, setProgress] = useState(0);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  useEffect(() => {
    const timer = setTimeout(() => setProgress(value), 50);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div
      className="progress-ring"
      aria-label={`${completed} of ${total} complete`}
    >
      <svg className="progress-ring-svg" viewBox="0 0 60 60" aria-hidden="true">
        <circle className="progress-ring-track" cx="30" cy="30" r={radius} />
        <circle
          className="progress-ring-value"
          cx="30"
          cy="30"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * progress) / 100}
        />
      </svg>
      <div className="progress-ring-label">
        {completed}/{total}
      </div>
    </div>
  );
}
function TaskCard({
  task,
  overdue,
  pending,
  run,
  editing,
  setEditing,
  onCompletionChange,
}: {
  task: WeekTask;
  overdue?: boolean;
  pending: string | null;
  run: Runner;
  editing: boolean;
  setEditing: (value: PlannerId | null) => void;
  onCompletionChange?: (id: PlannerId, completed: boolean) => void;
}) {
  const completed = task.status === "completed";
  const [visualCompleted, setVisualCompleted] = useState(completed);
  const [checkAnimation, setCheckAnimation] = useState<
    "complete" | "reopen" | null
  >(null);
  useEffect(() => setVisualCompleted(completed), [completed]);
  useEffect(() => {
    if (!checkAnimation) return;
    const timer = window.setTimeout(() => setCheckAnimation(null), 360);
    return () => window.clearTimeout(timer);
  }, [checkAnimation]);
  function toggle(form: FormData) {
    const nextCompleted = !visualCompleted;
    form.set("revision", String(task.revision ?? 1));
    form.set("completed", String(nextCompleted));
    setVisualCompleted(nextCompleted);
    setCheckAnimation(nextCompleted ? "complete" : "reopen");
    onCompletionChange?.(task.id, nextCompleted);
    run(`toggle-${task.id}`, toggleTask, form);
  }
  const animationClass = checkAnimation
    ? `week-task-checking-${checkAnimation}`
    : "";
  const checkAnimationClass = checkAnimation
    ? `task-check-animate-${checkAnimation}`
    : "";
  return (
    <article
      className={`week-task-card ${visualCompleted ? "week-task-completed" : ""} ${animationClass}`}
    >
      <div className="flex gap-3">
        <form action={toggle}>
          <input type="hidden" name="id" value={task.id} />
          <TaskCompletionButton
            type="submit"
            title={task.title}
            completed={visualCompleted}
            pending={pending === `toggle-${task.id}`}
            animating={checkAnimation === "complete"}
            className={checkAnimationClass}
          />
        </form>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{task.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {categoryLabels[task.category]}
            {task.recurrenceCount
              ? ` · Weekly routine: ${task.recurrenceCount} ${task.recurrenceCount === 1 ? "check-in" : "check-ins"}`
              : ""}
            {overdue && (
              <> · Overdue from {format(parseISO(task.date), "MMM d")}</>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing(editing ? null : task.id)}
          className="week-task-menu-button text-muted-foreground"
          aria-expanded={editing}
        >
          ...
        </button>
      </div>
      <EditForm
        task={task}
        open={editing}
        pending={pending === `update-${task.id}`}
        onSave={(form) =>
          run(`update-${task.id}`, updateTask, form, () => setEditing(null))
        }
        onDelete={(form) =>
          run(`delete-${task.id}`, deleteTask, form, () => setEditing(null))
        }
        onClose={() => setEditing(null)}
      />
    </article>
  );
}
function Board({
  tasks,
  weekStart,
  anytime,
  recurringAnytime,
  editing,
  setEditing,
  pending,
  run,
  anytimeProgress,
  onCompletionChange,
}: {
  tasks: WeekTask[];
  weekStart: string;
  anytime: WeekTask[];
  recurringAnytime: WeeklyRecurrence[];
  editing: PlannerId | null;
  setEditing: (value: PlannerId | null) => void;
  pending: string | null;
  run: Runner;
  anytimeProgress: AnytimeProgress;
  onCompletionChange: (id: PlannerId, completed: boolean) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<PlannerId | null>(null);
  const [movingId, setMovingId] = useState<PlannerId | null>(null);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>("not_started");
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, TaskStatus>>({});

  useEffect(() => {
    setOptimisticStatuses((current) => {
      const next = { ...current };
      let changed = false;
      for (const task of tasks) {
        if (next[task.id] === task.status) {
          delete next[task.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [tasks]);

  function taskStatus(task: WeekTask) {
    return optimisticStatuses[task.id] ?? task.status;
  }

  async function moveTask(id: PlannerId, status: TaskStatus) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) return false;
    const previousStatus = taskStatus(task);
    if (previousStatus === status) return true;

    setOptimisticStatuses((current) => ({ ...current, [id]: status }));
    setMovingId(id);
    const form = new FormData();
    form.set("id", String(id));
    form.set("revision", String(task.revision ?? 1));
    form.set("status", status);
    let moved = false;
    await run(`workflow-${id}`, setTaskWorkflow, form, () => {
      moved = true;
    });
    if (!moved) {
      setOptimisticStatuses((current) => {
        const next = { ...current };
        if (previousStatus === task.status) delete next[id];
        else next[id] = previousStatus;
        return next;
      });
    }
    window.setTimeout(
      () => setMovingId((current) => (current === id ? null : current)),
      360,
    );
    return moved;
  }

  function drop(event: ReactDragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    event.stopPropagation();
    const transferredId =
      event.dataTransfer.getData("application/x-myplanner-task") ||
      event.dataTransfer.getData("text/plain");
    const transferredTask = tasks.find(
      (task) => String(task.id) === transferredId,
    );
    const id = transferredTask?.id ?? dragIdRef.current;
    clearDragStyles();
    dragIdRef.current = null;
    // Let Chromium finish its native drop/dragend lifecycle before the
    // optimistic update relocates (and therefore unmounts) the source card.
    if (id) window.setTimeout(() => void moveTask(id, status), 0);
  }

  function clearDragStyles() {
    boardRef.current
      ?.querySelectorAll(".kanban-card-dragging, .kanban-column-drop-target")
      .forEach((element) => {
        element.classList.remove("kanban-card-dragging", "kanban-column-drop-target");
      });
  }

  function finishDrag() {
    clearDragStyles();
    dragIdRef.current = null;
  }
  return (
    <div ref={boardRef} className="kanban-board" onDragEnd={finishDrag}>
      <section className="kanban-anytime-column">
        <div className="kanban-anytime-header">
          <div>
            <h2 className="text-sm font-semibold">Anytime this week</h2>
            <p className="text-xs text-muted-foreground">
              Flexible tasks and weekly routines can be done on any day.
            </p>
          </div>
          <ProgressRing
            value={anytimeProgress.value}
            completed={anytimeProgress.completed}
            total={anytimeProgress.total}
          />
        </div>
        {recurringAnytime.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
              Weekly routines
            </p>
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              Each circle is one check-in. Every target starts fresh on Monday.
            </p>
            <div className="space-y-2">
              {recurringAnytime.map((recurrence) => (
                <RecurringTaskCard
                  key={recurrence.recurrenceId}
                  recurrence={recurrence}
                  pending={pending}
                  run={run}
                  editing={editing === recurrence.tasks[0]?.id}
                  setEditing={setEditing}
                  onCompletionChange={onCompletionChange}
                  kanban
                />
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
          {anytime.length ? (
            anytime.map((task) => (
              <AnytimeKanbanTaskCard
                key={task.id}
                task={task}
                pending={pending}
                run={run}
                editing={editing === task.id}
                setEditing={setEditing}
                onCompletionChange={onCompletionChange}
              />
            ))
          ) : recurringAnytime.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No flexible tasks yet.
            </p>
          ) : null}
        </div>
      </section>
      <section className="kanban-mobile-board" aria-label="Task workflow">
        <div className="kanban-mobile-heading">
          <h2 className="text-sm font-semibold">Task workflow</h2>
          <p className="text-xs text-muted-foreground">
            Pick a stage, then move tasks with the control on each card.
          </p>
        </div>
        <div
          className="kanban-mobile-stages"
          role="tablist"
          aria-label="Workflow stage"
        >
          {workflow.map((column) => {
            const count = tasks.filter((task) => taskStatus(task) === column.status).length;
            return (
              <button
                key={column.status}
                type="button"
                role="tab"
                aria-selected={mobileStatus === column.status}
                onClick={() => setMobileStatus(column.status)}
                className={`kanban-mobile-stage kanban-status-${column.status}`}
              >
                <span className="kanban-status-dot" />
                <span>{column.label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
        <div className="kanban-mobile-task-list" role="tabpanel">
          {tasks.filter((task) => taskStatus(task) === mobileStatus).length ? (
            tasks
              .filter((task) => taskStatus(task) === mobileStatus)
              .map((task) => (
                <KanbanCard
                  key={task.id}
                  task={{ ...task, status: taskStatus(task) }}
                  overdue={
                    task.anytimeWeekStart
                      ? task.anytimeWeekStart < weekStart
                      : task.date < weekStart
                  }
                  column={mobileStatus}
                  pending={pending}
                  moving={movingId === task.id}
                  onDragStart={() => undefined}
                  onChange={(status) => {
                    const previousStatus = taskStatus(task);
                    setMobileStatus(status);
                    void moveTask(task.id, status).then((moved) => {
                      if (!moved) setMobileStatus(previousStatus);
                    });
                  }}
                  run={run}
                  onCompletionChange={onCompletionChange}
                  editing={editing === task.id}
                  setEditing={setEditing}
                  mobile
                />
              ))
          ) : (
            <p className="kanban-mobile-empty">
              No tasks in{" "}
              {workflow
                .find((column) => column.status === mobileStatus)
                ?.label.toLowerCase()}
              .
            </p>
          )}
        </div>
      </section>
      <div className="kanban-status-columns kanban-status-columns-desktop grid gap-4 xl:grid-cols-4">
        {workflow.map((column) => (
          <section
            key={column.status}
            onDragEnter={(event) => {
              event.currentTarget.classList.add("kanban-column-drop-target");
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                event.currentTarget.classList.remove("kanban-column-drop-target");
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => drop(event, column.status)}
            className="kanban-column"
          >
            <h2 className="px-1 pb-3 text-sm font-semibold">
              {column.label}{" "}
              <span className="text-muted-foreground">
                {tasks.filter((task) => taskStatus(task) === column.status).length}
              </span>
            </h2>
            <div className="space-y-2">
              {tasks
                .filter((task) => taskStatus(task) === column.status)
                .map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={{ ...task, status: taskStatus(task) }}
                    overdue={
                      task.anytimeWeekStart
                        ? task.anytimeWeekStart < weekStart
                        : task.date < weekStart
                    }
                    column={column.status}
                    pending={pending}
                    moving={movingId === task.id}
                    onDragStart={(event) => {
                      dragIdRef.current = task.id;
                      event.currentTarget.classList.add("kanban-card-dragging");
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-myplanner-task", String(task.id));
                      event.dataTransfer.setData("text/plain", String(task.id));
                    }}
                    onChange={(status) => void moveTask(task.id, status)}
                    run={run}
                    onCompletionChange={onCompletionChange}
                    editing={editing === task.id}
                    setEditing={setEditing}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
function AnytimeKanbanTaskCard({
  task,
  pending,
  run,
  editing,
  setEditing,
  onCompletionChange,
}: {
  task: WeekTask;
  pending: string | null;
  run: Runner;
  editing: boolean;
  setEditing: (value: PlannerId | null) => void;
  onCompletionChange: (id: PlannerId, completed: boolean) => void;
}) {
  const [visualCompleted, setVisualCompleted] = useState(
    task.status === "completed",
  );
  const [celebrating, setCelebrating] = useState(false);
  function toggle(form: FormData) {
    const nextCompleted = !visualCompleted;
    form.set("revision", String(task.revision ?? 1));
    form.set("completed", String(nextCompleted));
    setVisualCompleted(nextCompleted);
    if (nextCompleted) {
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), COMPLETION_FEEDBACK_MS);
    }
    onCompletionChange(task.id, nextCompleted);
    return run(`toggle-${task.id}`, toggleTask, form);
  }
  return (
    <article
      className={`week-task-card anytime-kanban-task-card ${visualCompleted ? "week-task-completed" : ""} ${celebrating ? "week-task-checking-complete" : ""}`}
    >
      <div className="flex items-start gap-3">
        <form action={toggle}>
          <input type="hidden" name="id" value={task.id} />
          <TaskCompletionButton
            type="submit"
            title={task.title}
            completed={visualCompleted}
            pending={pending === `toggle-${task.id}`}
            animating={celebrating}
          />
        </form>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{task.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {categoryLabels[task.category]} · Flexible this week
          </p>
        </div>
        <button
          onClick={() => setEditing(editing ? null : task.id)}
          className="week-task-menu-button text-muted-foreground"
          aria-label={`Edit ${task.title}`}
          aria-expanded={editing}
        >
          ...
        </button>
      </div>
      <EditForm
        task={task}
        open={editing}
        pending={pending === `update-${task.id}`}
        onSave={(form) =>
          run(`update-${task.id}`, updateTask, form, () => setEditing(null))
        }
        onDelete={(form) =>
          run(`delete-${task.id}`, deleteTask, form, () => setEditing(null))
        }
        onClose={() => setEditing(null)}
      />
    </article>
  );
}
function KanbanCard({
  task,
  overdue,
  column,
  pending,
  moving,
  onDragStart,
  onChange,
  run,
  onCompletionChange,
  editing,
  setEditing,
  mobile = false,
}: {
  task: WeekTask;
  overdue: boolean;
  column: TaskStatus;
  pending: string | null;
  moving: boolean;
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  onChange: (status: TaskStatus) => void;
  run: Runner;
  onCompletionChange?: (id: PlannerId, completed: boolean) => void;
  editing: boolean;
  setEditing: (value: PlannerId | null) => void;
  mobile?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article
      draggable={!mobile}
      onDragStart={onDragStart}
      className={`kanban-card ${mobile ? "kanban-card-mobile" : ""} ${overdue ? "kanban-card-overdue" : ""} ${moving ? "kanban-card-moving" : ""} ${menuOpen ? "kanban-card-menu-open" : ""}`}
    >
      <div className="flex items-start gap-2">
        {!mobile && (
          <GripVertical
            size={16}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{task.title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {categoryLabels[task.category]} · {overdue ? "Overdue from " : ""}
            {format(parseISO(task.anytimeWeekStart ?? task.date), "MMM d")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(editing ? null : task.id)}
          className="week-task-menu-button text-muted-foreground"
          aria-label={`Edit ${task.title}`}
          aria-expanded={editing}
        >
          ...
        </button>
      </div>
      {mobile && <p className="kanban-mobile-move-label">Move task to</p>}
      {(column !== "done" || mobile) && (
        <StatusSelect
          task={task}
          pending={pending}
          moving={moving}
          onChange={onChange}
          onOpenChange={setMenuOpen}
        />
      )}
      {column === "done" && (
        <form
          className={mobile ? "mt-2" : "mt-3"}
          action={(form) => {
            form.set("revision", String(task.revision ?? 1));
            onCompletionChange?.(task.id, true);
            return run(`confirm-${task.id}`, confirmTaskCompletion, form);
          }}
        >
          <input type="hidden" name="id" value={task.id} />
          <button
            disabled={pending === `confirm-${task.id}`}
            className="w-full rounded-xl bg-[var(--orange)] px-3 py-2 text-xs font-semibold text-white"
          >
            Confirm complete
          </button>
        </form>
      )}
      <EditForm
        task={task}
        open={editing}
        pending={pending === `update-${task.id}`}
        onSave={(form) =>
          run(`update-${task.id}`, updateTask, form, () => setEditing(null))
        }
        onDelete={(form) =>
          run(`delete-${task.id}`, deleteTask, form, () => setEditing(null))
        }
        onClose={() => setEditing(null)}
      />
    </article>
  );
}
function StatusSelect({
  task,
  pending,
  moving,
  onChange,
  onOpenChange,
}: {
  task: WeekTask;
  pending: string | null;
  moving: boolean;
  onChange: (status: TaskStatus) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current =
    workflow.find((option) => option.status === task.status) ?? workflow[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
        onOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open, onOpenChange]);

  function toggleMenu() {
    const nextOpen = !open;
    setOpen(nextOpen);
    onOpenChange(nextOpen);
  }
  return (
    <div ref={menuRef} className="kanban-status-select">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={moving || pending === `workflow-${task.id}`}
        onClick={toggleMenu}
        className={`kanban-status-trigger kanban-status-${task.status}`}
      >
        <span className="kanban-status-dot" />
        {current.label}
        <ChevronDown
          size={14}
          className={open ? "kanban-status-chevron-open" : ""}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={`Move ${task.title}`}
          className="kanban-status-menu"
        >
          {workflow.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.status === task.status}
              key={option.status}
              onClick={() => {
                setOpen(false);
                onOpenChange(false);
                if (option.status !== task.status) onChange(option.status);
              }}
              className={`kanban-status-option kanban-status-option-${option.status} ${option.status === task.status ? "kanban-status-option-active" : ""}`}
            >
              <span
                className={`kanban-status-dot kanban-status-dot-${option.status}`}
              />
              {option.label}
              {option.status === task.status && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function EditForm({
  task,
  open,
  pending,
  onSave,
  onDelete,
  onClose,
}: {
  task: WeekTask;
  open: boolean;
  pending: boolean;
  onSave: (form: FormData) => Promise<void>;
  onDelete: (form: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const requestConfirmation = useContext(ConfirmDialogContext);
  const [recurrenceCount, setRecurrenceCount] = useState(
    String(task.recurrenceCount ?? 0),
  );
  const [placement, setPlacement] = useState(
    task.anytimeWeekStart ? `anytime:${task.anytimeWeekStart}` : task.date,
  );
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [submitting, setSubmitting] = useState(false);
  const weekStart = format(
    startOfWeek(parseISO(task.date), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const dates = Array.from({ length: 7 }, (_, index) =>
    format(addDays(parseISO(weekStart), index), "yyyy-MM-dd"),
  );
  const anytime = placement.startsWith("anytime:");

  async function submit(form: FormData) {
    form.set("revision", String(task.revision ?? 1));
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    await onSave(form);
    setSubmitting(false);
  }
  function remove() {
    requestConfirmation({
      title: `Delete “${task.title}”?`,
      description:
        "This task will be permanently removed. Completed history stays intact.",
      confirmLabel: "Delete task",
      action: async () => {
        setSubmitting(true);
        const form = new FormData();
        form.set("id", String(task.id));
        form.set("revision", String(task.revision ?? 1));
        await onDelete(form);
        setSubmitting(false);
      },
    });
  }

  return (
    <div
      className={`task-edit-shell ${open && !submitting ? "task-edit-shell-open" : "task-edit-shell-closed"}`}
      aria-hidden={!open}
    >
      <form action={submit} className="task-edit-panel">
        <input type="hidden" name="id" value={task.id} />
        <input
          type="hidden"
          name="anytimeWeekStart"
          value={anytime ? weekStart : ""}
        />
        <input
          type="hidden"
          name="date"
          value={anytime ? weekStart : placement}
        />
        <input type="hidden" name="category" value={category} />
        <input
          className={inputClass}
          name="title"
          defaultValue={task.title}
          required
        />
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
            When
          </p>
          <div className="choice-grid">
            <button
              type="button"
              onClick={() => setPlacement(`anytime:${weekStart}`)}
              className={
                anytime ? "choice-chip choice-chip-active" : "choice-chip"
              }
            >
              Anytime
            </button>
            {dates.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setPlacement(value);
                  setRecurrenceCount("0");
                }}
                className={
                  placement === value
                    ? "choice-chip choice-chip-active"
                    : "choice-chip"
                }
              >
                {format(parseISO(value), "EEE d")}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
            Category
          </p>
          <div className="choice-grid">
            {categories.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setCategory(value)}
                className={
                  category === value
                    ? "choice-chip choice-chip-active"
                    : "choice-chip"
                }
              >
                {categoryLabels[value]}
              </button>
            ))}
          </div>
        </div>
        {anytime ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
              Weekly routine
            </p>
            <p className="mt-1 mb-2 text-xs leading-5 text-muted-foreground">
              Choose your check-ins for each week. The target resets every Monday.
            </p>
            <div className="choice-grid" aria-label="Weekly check-in target">
              <button
                type="button"
                onClick={() => setRecurrenceCount("0")}
                className={
                  recurrenceCount === "0"
                    ? "choice-chip choice-chip-active"
                    : "choice-chip"
                }
              >
                One-off task
              </button>
              {Array.from({ length: 7 }, (_, index) => index + 1).map(
                (count) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => setRecurrenceCount(String(count))}
                    className={
                      recurrenceCount === String(count)
                        ? "choice-chip choice-chip-active"
                        : "choice-chip"
                    }
                  >
                    {count} {count === 1 ? "check-in" : "check-ins"}
                  </button>
                ),
              )}
            </div>
            <input
              type="hidden"
              name="recurrenceCount"
              value={recurrenceCount}
            />
          </div>
        ) : (
          <input type="hidden" name="recurrenceCount" value="0" />
        )}
        <input type="hidden" name="priority" value={task.priority} />
        <input
          type="hidden"
          name="description"
          value={task.description ?? ""}
        />
        <input
          type="hidden"
          name="estimatedMinutes"
          value={task.estimatedMinutes ?? ""}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={remove}
            className="text-xs font-medium text-rose-700"
          >
            Delete task
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              disabled={pending || submitting}
              className="rounded-lg bg-[var(--orange)] px-3 py-1.5 text-sm font-medium text-white"
            >
              {pending || submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
