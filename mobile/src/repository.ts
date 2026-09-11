import type { PostgrestError } from "@supabase/supabase-js";
import type { Json } from "@/src/lib/supabase/database.types";
import {
  isPlannerRpcFailure,
  type PlannerRpcResult,
} from "@/src/lib/supabase/planner-errors";
import type { FocusArea, FocusMilestone } from "@/src/lib/focus-areas";
import type { TaskStatus } from "@/src/lib/today";
import type { PlannedTaskInput } from "@/src/lib/week-planning";
import {
  MobileAuthError,
  MobileDataError,
  mobileSupabase,
  requireMobileSession,
} from "./supabase";

type TaskRow = import("@/src/lib/supabase/database.types").Database["public"]["Tables"]["tasks"]["Row"];
type FocusRow = import("@/src/lib/supabase/database.types").Database["public"]["Tables"]["daily_focus"]["Row"];
type RecurrenceRow = import("@/src/lib/supabase/database.types").Database["public"]["Tables"]["task_recurrences"]["Row"];

function fail(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === "PGRST301" || error.message.toLowerCase().includes("jwt")) {
    throw new MobileAuthError();
  }
  throw new MobileDataError(error.message);
}

function rpcResult<T>(data: Json | null, error: PostgrestError | null) {
  fail(error);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MobileDataError("The planner returned an invalid response.");
  }
  const result = data as PlannerRpcResult<T>;
  if (isPlannerRpcFailure(result)) {
    if (result.code === "stale") {
      throw new MobileDataError(
        "This item changed in another session. Refresh and try again.",
      );
    }
    throw new MobileDataError(
      result.message ??
        (result.code === "not_found"
          ? "That item no longer exists."
          : "That change is no longer valid."),
    );
  }
  return result;
}

function taskInputJson(input: PlannedTaskInput): Json {
  return {
    title: input.title,
    description: input.description ?? "",
    category: "other",
    priority: input.priority,
    date: input.date,
    estimated_minutes: input.estimatedMinutes?.toString() ?? "",
    anytime_week_start: input.anytimeWeekStart ?? "",
  };
}

export async function ensureRecurringInstances(weekStart: string) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("ensure_recurring_instances", {
    p_week_start: weekStart,
  });
  rpcResult<Record<string, never>>(data, error);
}

export async function createPlannedTask(
  input: PlannedTaskInput,
  recurrenceCount?: number,
) {
  await requireMobileSession();
  if (recurrenceCount) {
    const { data, error } = await mobileSupabase.rpc("create_or_update_recurrence", {
      p_input: {
        title: input.title,
        description: input.description ?? "",
        category: "other",
        priority: input.priority,
        estimated_minutes: input.estimatedMinutes?.toString() ?? "",
        count_per_week: recurrenceCount,
        start_week: input.anytimeWeekStart!,
        active: true,
      },
      p_client_recurrence_id: crypto.randomUUID(),
    });
    const created = rpcResult<{ recurrence: RecurrenceRow }>(data, error);
    const { data: categoryData, error: categoryError } = await mobileSupabase.rpc("assign_recurrence_category", {
      p_recurrence_id: created.recurrence.id,
      p_expected_revision: created.recurrence.revision,
      p_category_id: input.category,
    });
    rpcResult<{ recurrence: RecurrenceRow }>(categoryData, categoryError);
    await ensureRecurringInstances(input.anytimeWeekStart!);
    return;
  }
  const { data, error } = await mobileSupabase.rpc("create_task", {
    p_input: taskInputJson(input),
    p_client_task_id: crypto.randomUUID(),
  });
  const created = rpcResult<{ task: TaskRow }>(data, error);
  const { data: categoryData, error: categoryError } = await mobileSupabase.rpc("assign_task_category", {
    p_task_id: created.task.id,
    p_expected_revision: created.task.revision,
    p_category_id: input.category,
  });
  rpcResult<{ task: TaskRow }>(categoryData, categoryError);
}

export async function updatePlannedTask(
  id: string,
  revision: number,
  input: PlannedTaskInput,
  recurrenceCount?: number,
) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("update_planned_task", {
    p_task_id: id,
    p_expected_revision: revision,
    p_input: taskInputJson(input),
    p_recurrence_count: recurrenceCount,
  });
  const updated = rpcResult<{ task: TaskRow; recurrence?: RecurrenceRow }>(data, error);
  const { data: categoryData, error: categoryError } = await mobileSupabase.rpc("assign_task_category", {
    p_task_id: updated.task.id,
    p_expected_revision: updated.task.revision,
    p_category_id: input.category,
  });
  rpcResult<{ task: TaskRow }>(categoryData, categoryError);
  if (recurrenceCount && input.anytimeWeekStart) {
    await ensureRecurringInstances(input.anytimeWeekStart);
  }
}

export async function setTaskCompleted(id: string, revision: number, completed: boolean) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("set_task_completed", {
    p_task_id: id,
    p_expected_revision: revision,
    p_completed: completed,
  });
  rpcResult<{ task: TaskRow }>(data, error);
}

type RevisionRpc = "delete_task" | "move_task_to_tomorrow" | "complete_task";

async function runRevisionRpc(name: RevisionRpc, id: string, revision: number) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc(name, {
    p_task_id: id,
    p_expected_revision: revision,
  });
  rpcResult<Record<string, unknown>>(data, error);
}

export const deletePlannedTask = (id: string, revision: number) =>
  runRevisionRpc("delete_task", id, revision);
export const movePlannedTaskToTomorrow = (id: string, revision: number) =>
  runRevisionRpc("move_task_to_tomorrow", id, revision);
export const confirmPlannedTaskCompletion = (id: string, revision: number) =>
  runRevisionRpc("complete_task", id, revision);

export async function reorderPlannedTask(
  id: string,
  revision: number,
  direction: "up" | "down",
) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("reorder_task", {
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
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("set_task_workflow", {
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
  await requireMobileSession();
  const { data, error } = await mobileSupabase.rpc("save_daily_focus", {
    p_date: date,
    p_career_mission: careerMission,
    p_content_mission: contentMission,
    p_expected_revision: revision,
  });
  rpcResult<{ focus: FocusRow }>(data, error);
}

async function optimisticMiss(
  table: "quick_thoughts" | "content_milestones",
  id: string,
) {
  const { data, error } = await mobileSupabase
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  throw new MobileDataError(
    data
      ? "This item changed in another session. Refresh and try again."
      : "That item no longer exists.",
  );
}

export async function createPlannerThought(text: string) {
  const session = await requireMobileSession();
  const { error } = await mobileSupabase.from("quick_thoughts").insert({
    id: crypto.randomUUID(),
    user_id: session.user.id,
    text,
  });
  fail(error);
}

export async function updatePlannerThought(id: string, revision: number, text: string) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase
    .from("quick_thoughts")
    .update({ text })
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss("quick_thoughts", id);
}

export async function deletePlannerThought(id: string, revision: number) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase
    .from("quick_thoughts")
    .delete()
    .eq("id", id)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss("quick_thoughts", id);
}

type MilestoneValues = {
  label: string;
  type: FocusMilestone["type"];
  targetValue?: number;
};

export async function createPlannerMilestone(category: FocusArea, values: MilestoneValues) {
  const session = await requireMobileSession();
  const { error } = await mobileSupabase.from("content_milestones").insert({
    id: crypto.randomUUID(),
    user_id: session.user.id,
    category: "content",
    category_id: category,
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
  await requireMobileSession();
  const { data, error } = await mobileSupabase
    .from("content_milestones")
    .update({
      label: values.label,
      type: values.type,
      target_value: values.targetValue ?? null,
    })
    .eq("id", id)
    .eq("category_id", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss("content_milestones", id);
}

export async function setPlannerMilestoneAchieved(
  id: string,
  revision: number,
  category: FocusArea,
  achieved: boolean,
) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase
    .from("content_milestones")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("category_id", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss("content_milestones", id);
}

export async function deletePlannerMilestone(
  id: string,
  revision: number,
  category: FocusArea,
) {
  await requireMobileSession();
  const { data, error } = await mobileSupabase
    .from("content_milestones")
    .delete()
    .eq("id", id)
    .eq("category_id", category)
    .eq("revision", revision)
    .select("id")
    .maybeSingle();
  fail(error);
  if (!data) await optimisticMiss("content_milestones", id);
}
