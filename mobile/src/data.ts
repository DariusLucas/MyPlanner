import { addDays, addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";
import type { DashboardData, QuickThought } from "@/src/lib/dashboard";
import type { FocusArea, FocusAreaData, FocusMilestone } from "@/src/lib/focus-areas";
import { calculateProductiveStreak, calculateProgress, localDateInTimeZone, type ProgressCategory } from "@/src/lib/progress";
import type { TaskCategory, TaskPriority, TaskStatus, TodayTask } from "@/src/lib/today";
import type { WeekData, WeekTask, WeeklyRecurrence } from "@/src/lib/week";
import { ensureRecurringInstances } from "./repository";
import { MobileAuthError, MobileDataError, mobileSupabase, requireMobileSession } from "./supabase";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type RecurrenceRow = Database["public"]["Tables"]["task_recurrences"]["Row"];
type MilestoneRow = Database["public"]["Tables"]["content_milestones"]["Row"];
type ThoughtRow = Database["public"]["Tables"]["quick_thoughts"]["Row"];

function fail(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === "PGRST301" || error.message.toLowerCase().includes("jwt")) throw new MobileAuthError();
  throw new MobileDataError(error.message);
}

function taskFromRow(row: TaskRow): TodayTask {
  return {
    id: row.id, title: row.title, description: row.description,
    category: row.category as TaskCategory, goalId: row.goal_id,
    sprintId: row.sprint_id, sprintWeekId: row.sprint_week_id,
    date: row.date, anytimeWeekStart: row.anytime_week_start,
    recurrenceId: row.recurrence_id, recurrenceWeekStart: row.recurrence_week_start,
    recurrenceIndex: row.recurrence_index, priority: row.priority as TaskPriority,
    status: row.status as TaskStatus, position: row.position,
    estimatedMinutes: row.estimated_minutes, completedAt: row.completed_at,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function thoughtFromRow(row: ThoughtRow): QuickThought {
  return { id: row.id, text: row.text, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}

function milestoneFromRow(row: MilestoneRow): FocusMilestone {
  return {
    id: row.id, category: row.category as FocusArea, label: row.label,
    type: row.type as FocusMilestone["type"], targetValue: row.target_value,
    achievedAt: row.achieved_at, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function compareTasks(left: TodayTask, right: TodayTask) {
  return left.date.localeCompare(right.date) || left.position - right.position || String(left.id).localeCompare(String(right.id));
}

async function plannerContext() {
  const session = await requireMobileSession();
  const { data, error } = await mobileSupabase.from("app_settings").select("timezone").eq("user_id", session.user.id).maybeSingle();
  fail(error);
  return { timeZone: data?.timezone ?? "Europe/Bucharest" };
}

async function allTasks() {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.from("tasks").select("*").order("date").order("position").order("id");
  fail(error);
  return (data ?? []).map(taskFromRow);
}

export async function getDashboardData(): Promise<DashboardData> {
  const { timeZone } = await plannerContext();
  const now = new Date();
  const date = localDateInTimeZone(now, timeZone) ?? format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd");
  await ensureRecurringInstances(weekStart);
  const [taskResult, thoughtResult] = await Promise.all([
    mobileSupabase.from("tasks").select("*").order("date").order("position").order("id"),
    mobileSupabase.from("quick_thoughts").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  fail(taskResult.error); fail(thoughtResult.error);
  const tasks = (taskResult.data ?? []).map(taskFromRow);
  const thoughts = (thoughtResult.data ?? []).map(thoughtFromRow);
  const incomplete = (task: TodayTask) => task.status !== "completed" && task.status !== "skipped";
  const active = tasks.filter((task) => task.date === date && !task.anytimeWeekStart && incomplete(task));
  const overdue = tasks.filter((task) => task.date < date && !task.anytimeWeekStart && incomplete(task));
  const completedToday = tasks.filter((task) => task.status === "completed" && task.completedAt && localDateInTimeZone(task.completedAt, timeZone) === date)
    .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "") || String(right.id).localeCompare(String(left.id)));
  const completionDates = tasks.flatMap((task) => task.status === "completed" && task.completedAt ? [localDateInTimeZone(task.completedAt, timeZone)!] : []);
  const streak = calculateProductiveStreak(completionDates, date);
  const remaining = active.length + overdue.length;
  return {
    date, active, overdue, completedToday,
    counts: { completed: completedToday.length, remaining, planned: remaining + completedToday.length },
    streak: { ...streak, state: streak.graceDaysUsed === 0 ? "hot" : streak.graceDaysUsed === 1 ? "cooling" : "cold" },
    recentThoughts: thoughts.slice(0, 3), allThoughts: thoughts,
  };
}

export async function getFocusAreaData(category: FocusArea): Promise<FocusAreaData> {
  await requireMobileSession();
  const [taskResult, milestoneResult] = await Promise.all([
    mobileSupabase.from("tasks").select("*").eq("category", category).order("date").order("position").order("id"),
    mobileSupabase.from("content_milestones").select("*").eq("category", category).order("created_at").order("id"),
  ]);
  fail(taskResult.error); fail(milestoneResult.error);
  const tasks = (taskResult.data ?? []).map(taskFromRow);
  const milestones = (milestoneResult.data ?? []).map(milestoneFromRow);
  return {
    category,
    active: tasks.filter((task) => task.status !== "completed" && task.status !== "skipped"),
    completed: tasks.filter((task) => task.status === "completed").sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "") || String(right.id).localeCompare(String(left.id))),
    milestones: {
      active: milestones.filter((milestone) => !milestone.achievedAt),
      achieved: milestones.filter((milestone) => milestone.achievedAt).sort((left, right) => right.achievedAt!.localeCompare(left.achievedAt!)),
    },
  };
}

export async function getWeekData(weekStart: string): Promise<WeekData> {
  await requireMobileSession();
  await ensureRecurringInstances(weekStart);
  const weekEnd = format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const [taskResult, recurrenceResult] = await Promise.all([
    mobileSupabase.from("tasks").select("*").order("date").order("position").order("id"),
    mobileSupabase.from("task_recurrences").select("*").order("id"),
  ]);
  fail(taskResult.error); fail(recurrenceResult.error);
  const recurrenceCounts = new Map((recurrenceResult.data ?? []).map((row: RecurrenceRow) => [row.id, row.count_per_week]));
  const withCount = (task: TodayTask): WeekTask => ({ ...task, recurrenceCount: task.recurrenceId ? recurrenceCounts.get(String(task.recurrenceId)) ?? null : null });
  const tasks = (taskResult.data ?? []).map(taskFromRow).sort(compareTasks);
  const incomplete = (task: TodayTask) => task.status !== "completed" && task.status !== "skipped";
  const active = tasks.filter((task) => incomplete(task) && (task.anytimeWeekStart ? task.anytimeWeekStart <= weekStart : task.date <= weekEnd) && (!task.recurrenceId || task.recurrenceWeekStart === weekStart)).map(withCount);
  const completed = tasks.filter((task) => task.status === "completed" && ((task.date >= weekStart && task.date <= weekEnd) || task.anytimeWeekStart === weekStart)).map(withCount);
  const anytimeInstances = [...active, ...completed].filter((task) => task.anytimeWeekStart === weekStart && (!task.recurrenceId || !task.recurrenceCount || (task.recurrenceIndex ?? 0) < task.recurrenceCount))
    .sort((left, right) => left.position - right.position || String(left.id).localeCompare(String(right.id)));
  const previousWeekStart = format(addWeeks(parseISO(weekStart), -1), "yyyy-MM-dd");
  const missedLastWeek = new Map<string | number, number>();
  tasks.filter((task) => task.recurrenceWeekStart === previousWeekStart && task.status === "skipped").forEach((task) => {
    if (task.recurrenceId) missedLastWeek.set(task.recurrenceId, (missedLastWeek.get(task.recurrenceId) ?? 0) + 1);
  });
  const recurring = new Map<string | number, WeeklyRecurrence>();
  const anytime = anytimeInstances.filter((task) => {
    if (!task.recurrenceId || !task.recurrenceCount) return true;
    const group = recurring.get(task.recurrenceId) ?? { recurrenceId: task.recurrenceId, countPerWeek: task.recurrenceCount, tasks: [], missedLastWeek: missedLastWeek.get(task.recurrenceId) ?? 0 };
    group.tasks.push(task); recurring.set(task.recurrenceId, group); return false;
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    return { date, tasks: [...active.filter((task) => !task.anytimeWeekStart && task.date === date), ...completed.filter((task) => !task.anytimeWeekStart && task.date === date)] };
  });
  return {
    weekStart, weekEnd, days, anytime,
    recurringAnytime: [...recurring.values()].sort((left, right) => left.tasks[0]!.position - right.tasks[0]!.position || String(left.recurrenceId).localeCompare(String(right.recurrenceId))),
    overdue: active.filter((task) => task.anytimeWeekStart ? task.anytimeWeekStart < weekStart : task.date < weekStart),
    completed,
  };
}

export async function getProgressData(startDate: string | undefined, category: ProgressCategory | undefined) {
  const { timeZone } = await plannerContext();
  return calculateProgress(await allTasks(), { startDate, category, timeZone });
}

export function currentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}
