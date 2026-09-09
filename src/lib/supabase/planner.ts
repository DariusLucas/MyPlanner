import "server-only";

import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";
import type { Database, Json } from "./database.types";
import {
  isPlannerRpcFailure,
  type PlannerRpcResult,
} from "./planner-errors";
import type { DashboardData, QuickThought } from "@/src/lib/dashboard";
import type { FocusArea, FocusAreaData, FocusMilestone } from "@/src/lib/focus-areas";
import { calculateProductiveStreak, localDateInTimeZone } from "@/src/lib/progress";
import { buildWeekCompletion } from "@/src/lib/daily-completion";
import type { ProgressTask } from "@/src/lib/progress";
import type {
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TodayTask,
} from "@/src/lib/today";
import type { PlannedTaskInput } from "@/src/lib/week-planning";
import type { WeekData, WeekTask, WeeklyRecurrence } from "@/src/lib/week";

type PlannerClient = SupabaseClient<Database>;
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type FocusRow = Database["public"]["Tables"]["daily_focus"]["Row"];
type RecurrenceRow = Database["public"]["Tables"]["task_recurrences"]["Row"];
type MilestoneRow = Database["public"]["Tables"]["content_milestones"]["Row"];
type ThoughtRow = Database["public"]["Tables"]["quick_thoughts"]["Row"];

export class PlannerAuthError extends Error {
  constructor() {
    super("Your session has expired. Sign in again.");
    this.name = "PlannerAuthError";
  }
}

export class PlannerDataError extends Error {
  constructor(message = "Something went wrong. Please try again.") {
    super(message);
    this.name = "PlannerDataError";
  }
}

function fail(error: PostgrestError | null) {
  if (error) throw new PlannerDataError(error.message);
}

async function authenticatedContext() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || typeof userId !== "string") throw new PlannerAuthError();
  return { client, userId };
}

function rpcResult<T>(data: Json | null, error: PostgrestError | null) {
  fail(error);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new PlannerDataError("The planner returned an invalid response.");
  }

  const result = data as PlannerRpcResult<T>;
  if (isPlannerRpcFailure(result)) {
    if (result.code === "stale") {
      throw new PlannerDataError(
        "This item changed in another session. Refresh and try again.",
      );
    }
    throw new PlannerDataError(
      result.message ??
        (result.code === "not_found"
          ? "That item no longer exists."
          : "That change is no longer valid."),
    );
  }
  return result;
}

function taskFromRow(row: TaskRow): TodayTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as TaskCategory,
    goalId: row.goal_id,
    sprintId: row.sprint_id,
    sprintWeekId: row.sprint_week_id,
    date: row.date,
    anytimeWeekStart: row.anytime_week_start,
    recurrenceId: row.recurrence_id,
    recurrenceWeekStart: row.recurrence_week_start,
    recurrenceIndex: row.recurrence_index,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    position: row.position,
    estimatedMinutes: row.estimated_minutes,
    completedAt: row.completed_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function milestoneFromRow(row: MilestoneRow): FocusMilestone {
  return {
    id: row.id,
    category: row.category as FocusArea,
    label: row.label,
    type: row.type as FocusMilestone["type"],
    targetValue: row.target_value,
    achievedAt: row.achieved_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function thoughtFromRow(row: ThoughtRow): QuickThought {
  return {
    id: row.id,
    text: row.text,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function compareTasks(a: TodayTask, b: TodayTask) {
  return (
    a.date.localeCompare(b.date) ||
    a.position - b.position ||
    String(a.id).localeCompare(String(b.id))
  );
}

function calculateDashboardStreak(completionDates: string[], today: string) {
  const { current, best, graceDaysUsed } = calculateProductiveStreak(
    completionDates,
    today,
  );
  return {
    current,
    best,
    state:
      graceDaysUsed === 0
        ? ("hot" as const)
        : graceDaysUsed === 1
          ? ("cooling" as const)
          : ("cold" as const),
    graceDaysUsed,
  };
}

function taskInputJson(input: PlannedTaskInput): Json {
  return {
    title: input.title,
    description: input.description ?? "",
    category: input.category,
    priority: input.priority,
    date: input.date,
    estimated_minutes: input.estimatedMinutes?.toString() ?? "",
    anytime_week_start: input.anytimeWeekStart ?? "",
  };
}

async function plannerTimeZone(client: PlannerClient, userId: string) {
  const { data, error } = await client
    .from("app_settings")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  fail(error);
  return data?.timezone ?? "Europe/Bucharest";
}

async function ensureRecurringInstances(client: PlannerClient, weekStart: string) {
  const { data, error } = await client.rpc("ensure_recurring_instances", {
    p_week_start: weekStart,
  });
  rpcResult<Record<string, never>>(data, error);
}

async function allTasks(client: PlannerClient) {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .order("date")
    .order("position")
    .order("id");
  fail(error);
  return (data ?? []).map(taskFromRow);
}

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
  const { client, userId } = await authenticatedContext();
  const timeZone = await plannerTimeZone(client, userId);
  const date = localDateInTimeZone(now, timeZone) ?? format(now, "yyyy-MM-dd");
  const weekStart = format(
    addDays(parseISO(date), -(Number(format(parseISO(date), "i")) - 1)),
    "yyyy-MM-dd",
  );
  await ensureRecurringInstances(client, weekStart);

  const recentCompletedStart = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
  const recentCompletedEnd = format(addDays(parseISO(date), 2), "yyyy-MM-dd");
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const [
    { data: activeRows, error: activeError },
    { data: completedRows, error: completedError },
    { data: completionRows, error: completionError },
    { data: thoughtRows, error: thoughtError },
    { data: weekRows, error: weekError },
  ] =
    await Promise.all([
      client.from("tasks").select("*").not("status", "in", "(completed,skipped)").lte("date", date).order("date").order("position").order("id"),
      client.from("tasks").select("*").eq("status", "completed").gte("completed_at", `${recentCompletedStart}T00:00:00.000Z`).lt("completed_at", `${recentCompletedEnd}T00:00:00.000Z`).order("completed_at", { ascending: false }).order("id", { ascending: false }),
      client.from("tasks").select("completed_at").eq("status", "completed").not("completed_at", "is", null).order("completed_at"),
      client.from("quick_thoughts").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }),
      client.from("tasks").select("date, anytime_week_start, status").gte("date", weekStart).lte("date", weekEnd),
    ]);
  fail(activeError);
  fail(completedError);
  fail(completionError);
  fail(thoughtError);
  fail(weekError);

  const tasks = (activeRows ?? []).map(taskFromRow);
  const completedTasks = (completedRows ?? []).map(taskFromRow);
  const thoughts = (thoughtRows ?? []).map(thoughtFromRow);
  const incomplete = (task: TodayTask) =>
    task.status !== "completed" && task.status !== "skipped";
  const active = tasks.filter(
    (task) =>
      incomplete(task) &&
      ((task.date === date && !task.anytimeWeekStart) ||
        task.anytimeWeekStart === weekStart),
  );
  const overdue = tasks.filter(
    (task) =>
      incomplete(task) &&
      ((!task.anytimeWeekStart && task.date < date) ||
        Boolean(task.anytimeWeekStart && task.anytimeWeekStart < weekStart)),
  );
  const completedToday = completedTasks
    .filter(
      (task) =>
        task.status === "completed" &&
        task.completedAt &&
        localDateInTimeZone(new Date(task.completedAt), timeZone) === date,
    )
    .sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? "") ||
      String(b.id).localeCompare(String(a.id)),
    );
  const completionDates = (completionRows ?? []).flatMap((task) =>
    task.completed_at
      ? [localDateInTimeZone(new Date(task.completed_at), timeZone)!]
      : [],
  );
  const remaining = active.length + overdue.length;

  return {
    date,
    active,
    overdue,
    completedToday,
    counts: {
      completed: completedToday.length,
      remaining,
      planned: remaining + completedToday.length,
    },
    weekCompletion: buildWeekCompletion(
      (weekRows ?? []).map((task) => ({
        date: task.date,
        anytimeWeekStart: task.anytime_week_start,
        status: task.status as TaskStatus,
      })),
      weekStart,
    ),
    streak: calculateDashboardStreak(completionDates, date),
    recentThoughts: thoughts.slice(0, 3),
    allThoughts: thoughts,
  };
}

export async function getWeekData(weekStart: string): Promise<WeekData> {
  const { client } = await authenticatedContext();
  await ensureRecurringInstances(client, weekStart);
  const weekEnd = format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [{ data: taskRows, error: taskError }, { data: recurrenceRows, error: recurrenceError }] =
    await Promise.all([
      client.from("tasks").select("*").order("date").order("position").order("id"),
      client.from("task_recurrences").select("*").order("id"),
    ]);
  fail(taskError);
  fail(recurrenceError);

  const recurrenceCounts = new Map(
    (recurrenceRows ?? []).map((row: RecurrenceRow) => [row.id, row.count_per_week]),
  );
  const addRecurrenceCount = (task: TodayTask): WeekTask => ({
    ...task,
    recurrenceCount: task.recurrenceId
      ? recurrenceCounts.get(String(task.recurrenceId)) ?? null
      : null,
  });
  const all = (taskRows ?? []).map(taskFromRow).sort(compareTasks);
  const incomplete = (task: TodayTask) =>
    task.status !== "completed" && task.status !== "skipped";
  const active = all
    .filter(
      (task) =>
        incomplete(task) &&
        (task.anytimeWeekStart
          ? task.anytimeWeekStart <= weekStart
          : task.date <= weekEnd) &&
        (!task.recurrenceId || task.recurrenceWeekStart === weekStart),
    )
    .map(addRecurrenceCount);
  const completed = all
    .filter(
      (task) =>
        task.status === "completed" &&
        ((task.date >= weekStart && task.date <= weekEnd) ||
          task.anytimeWeekStart === weekStart),
    )
    .map(addRecurrenceCount);
  const anytimeInstances = [...active, ...completed]
    .filter(
      (task) =>
        task.anytimeWeekStart === weekStart &&
        (!task.recurrenceId ||
          !task.recurrenceCount ||
          (task.recurrenceIndex ?? 0) < task.recurrenceCount),
    )
    .sort((a, b) =>
      a.position - b.position || String(a.id).localeCompare(String(b.id)),
    );
  const recurringById = new Map<string | number, WeeklyRecurrence>();
  const previousWeekStart = format(addWeeks(parseISO(weekStart), -1), "yyyy-MM-dd");
  const missedLastWeek = new Map<string | number, number>();
  all
    .filter(
      (task) =>
        task.recurrenceWeekStart === previousWeekStart && task.status === "skipped",
    )
    .forEach((task) => {
      if (task.recurrenceId) {
        missedLastWeek.set(
          task.recurrenceId,
          (missedLastWeek.get(task.recurrenceId) ?? 0) + 1,
        );
      }
    });
  const anytime = anytimeInstances.filter((task) => {
    if (!task.recurrenceId || !task.recurrenceCount) return true;
    const recurrence = recurringById.get(task.recurrenceId) ?? {
      recurrenceId: task.recurrenceId,
      countPerWeek: task.recurrenceCount,
      tasks: [],
      missedLastWeek: missedLastWeek.get(task.recurrenceId) ?? 0,
    };
    recurrence.tasks.push(task);
    recurringById.set(task.recurrenceId, recurrence);
    return false;
  });
  const recurringAnytime = [...recurringById.values()].sort(
    (a, b) =>
      a.tasks[0]!.position - b.tasks[0]!.position ||
      String(a.recurrenceId).localeCompare(String(b.recurrenceId)),
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    return {
      date,
      tasks: [
        ...active.filter((task) => !task.anytimeWeekStart && task.date === date),
        ...completed.filter((task) => !task.anytimeWeekStart && task.date === date),
      ],
    };
  });

  return {
    weekStart,
    weekEnd,
    days,
    anytime,
    recurringAnytime,
    overdue: active.filter((task) =>
      task.anytimeWeekStart
        ? task.anytimeWeekStart < weekStart
        : task.date < weekStart,
    ),
    completed,
  };
}

export async function getFocusAreaData(category: FocusArea): Promise<FocusAreaData> {
  const { client } = await authenticatedContext();
  const [{ data: taskRows, error: taskError }, { data: milestoneRows, error: milestoneError }] =
    await Promise.all([
      client.from("tasks").select("*").eq("category", category).order("date").order("position").order("id"),
      client.from("content_milestones").select("*").eq("category", category).order("created_at").order("id"),
    ]);
  fail(taskError);
  fail(milestoneError);
  const tasks = (taskRows ?? []).map(taskFromRow);
  const milestones = (milestoneRows ?? []).map(milestoneFromRow);
  return {
    category,
    active: tasks.filter(
      (task) => task.status !== "completed" && task.status !== "skipped",
    ),
    completed: tasks
      .filter((task) => task.status === "completed")
      .sort((a, b) =>
        (b.completedAt ?? "").localeCompare(a.completedAt ?? "") ||
        String(b.id).localeCompare(String(a.id)),
      ),
    milestones: {
      active: milestones.filter((milestone) => !milestone.achievedAt),
      achieved: milestones
        .filter((milestone) => milestone.achievedAt)
        .sort((a, b) => b.achievedAt!.localeCompare(a.achievedAt!)),
    },
  };
}

export async function getProgressTaskHistory(): Promise<ProgressTask[]> {
  const { client } = await authenticatedContext();
  const tasks = await allTasks(client);
  return tasks.map((task) => ({
    id: task.id,
    category: task.category,
    date: task.date,
    anytimeWeekStart: task.anytimeWeekStart,
    recurrenceId: task.recurrenceId,
    status: task.status,
    completedAt: task.completedAt,
  }));
}

export async function createPlannedTask(
  input: PlannedTaskInput,
  recurrenceCount?: number,
) {
  const { client } = await authenticatedContext();
  if (recurrenceCount) {
    const recurrenceId = crypto.randomUUID();
    const { data, error } = await client.rpc("create_or_update_recurrence", {
      p_input: {
        title: input.title,
        description: input.description ?? "",
        category: input.category,
        priority: input.priority,
        estimated_minutes: input.estimatedMinutes?.toString() ?? "",
        count_per_week: recurrenceCount,
        start_week: input.anytimeWeekStart!,
        active: true,
      },
      p_client_recurrence_id: recurrenceId,
    });
    rpcResult<{ recurrence: RecurrenceRow }>(data, error);
    await ensureRecurringInstances(client, input.anytimeWeekStart!);
    return;
  }

  const { data, error } = await client.rpc("create_task", {
    p_input: taskInputJson(input),
    p_client_task_id: crypto.randomUUID(),
  });
  rpcResult<{ task: TaskRow }>(data, error);
}

export async function updatePlannedTask(
  id: string,
  revision: number,
  input: PlannedTaskInput,
  recurrenceCount?: number,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc("update_planned_task", {
    p_task_id: id,
    p_expected_revision: revision,
    p_input: taskInputJson(input),
    p_recurrence_count: recurrenceCount,
  });
  rpcResult<{ task: TaskRow; recurrence?: RecurrenceRow }>(data, error);
  if (recurrenceCount && input.anytimeWeekStart) {
    await ensureRecurringInstances(client, input.anytimeWeekStart);
  }
}

export async function setTaskCompleted(
  id: string,
  revision: number,
  completed: boolean,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc("set_task_completed", {
    p_task_id: id,
    p_expected_revision: revision,
    p_completed: completed,
  });
  rpcResult<{ task: TaskRow }>(data, error);
}

type RevisionRpc =
  | "delete_task"
  | "move_task_to_tomorrow"
  | "complete_task";

async function runRevisionRpc(name: RevisionRpc, id: string, revision: number) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc(name, {
    p_task_id: id,
    p_expected_revision: revision,
  });
  rpcResult<Record<string, unknown>>(data, error);
}

export async function deletePlannedTask(id: string, revision: number) {
  await runRevisionRpc("delete_task", id, revision);
}

export async function movePlannedTaskToTomorrow(id: string, revision: number) {
  await runRevisionRpc("move_task_to_tomorrow", id, revision);
}

export async function confirmPlannedTaskCompletion(id: string, revision: number) {
  await runRevisionRpc("complete_task", id, revision);
}

export async function reorderPlannedTask(
  id: string,
  revision: number,
  direction: "up" | "down",
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc("reorder_task", {
    p_task_id: id,
    p_expected_revision: revision,
    p_direction: direction,
  });
  rpcResult<{ task: TaskRow }>(data, error);
}

export async function setPlannedTaskWorkflow(
  id: string,
  revision: number,
  status: Exclude<TaskStatus, "completed" | "skipped">,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc("set_task_workflow", {
    p_task_id: id,
    p_expected_revision: revision,
    p_status: status,
  });
  rpcResult<{ task: TaskRow }>(data, error);
}

export async function savePlannerDailyFocus(
  date: string,
  careerMission: string,
  contentMission: string,
  revision?: number,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client.rpc("save_daily_focus", {
    p_date: date,
    p_career_mission: careerMission,
    p_content_mission: contentMission,
    p_expected_revision: revision,
  });
  rpcResult<{ focus: FocusRow }>(data, error);
}

async function optimisticMiss(
  client: PlannerClient,
  table: "quick_thoughts" | "content_milestones",
  id: string,
) {
  const { data, error } = await client.from(table).select("id").eq("id", id).maybeSingle();
  fail(error);
  throw new PlannerDataError(
    data
      ? "This item changed in another session. Refresh and try again."
      : "That item no longer exists.",
  );
}

export async function createPlannerThought(text: string) {
  const { client, userId } = await authenticatedContext();
  const { error } = await client.from("quick_thoughts").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    text,
  });
  fail(error);
}

export async function updatePlannerThought(id: string, revision: number, text: string) {
  const { client } = await authenticatedContext();
  const { data, error } = await client
    .from("quick_thoughts")
    .update({ text })
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss(client, "quick_thoughts", id);
}

export async function deletePlannerThought(id: string, revision: number) {
  const { client } = await authenticatedContext();
  const { data, error } = await client
    .from("quick_thoughts")
    .delete()
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss(client, "quick_thoughts", id);
}

type MilestoneValues = {
  label: string;
  type: FocusMilestone["type"];
  targetValue?: number;
};

export async function createPlannerMilestone(category: FocusArea, values: MilestoneValues) {
  const { client, userId } = await authenticatedContext();
  const { error } = await client.from("content_milestones").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    category,
    label: values.label,
    type: values.type,
    target_value: values.targetValue ?? null,
  });
  fail(error);
}

export async function updatePlannerMilestone(
  id: string,
  revision: number,
  category: FocusArea,
  values: MilestoneValues,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client
    .from("content_milestones")
    .update({
      label: values.label,
      type: values.type,
      target_value: values.targetValue ?? null,
    })
    .eq("id", id)
    .eq("category", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss(client, "content_milestones", id);
}

export async function setPlannerMilestoneAchieved(
  id: string,
  revision: number,
  category: FocusArea,
  achieved: boolean,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client
    .from("content_milestones")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("category", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss(client, "content_milestones", id);
}

export async function deletePlannerMilestone(
  id: string,
  revision: number,
  category: FocusArea,
) {
  const { client } = await authenticatedContext();
  const { data, error } = await client
    .from("content_milestones")
    .delete()
    .eq("id", id)
    .eq("category", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss(client, "content_milestones", id);
}
