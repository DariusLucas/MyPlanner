"use server";

import { revalidatePath } from "next/cache";
import { isValid, parseISO } from "date-fns";
import { z } from "zod";
import { taskPriorities } from "@/src/lib/planner-values";
import {
  confirmPlannedTaskCompletion,
  createPlannedTask,
  deletePlannedTask,
  movePlannedTaskToTomorrow,
  PlannerAuthError,
  PlannerDataError,
  reorderPlannedTask,
  savePlannerDailyFocus,
  setPlannedTaskWorkflow,
  setTaskCompleted,
  updatePlannedTask,
} from "@/src/lib/supabase/planner";

export type ActionResult = { ok: true } | { ok: false; error: string };

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)), "Choose a valid date.");
const idSchema = z.string().uuid();
const revisionSchema = z.coerce.number().int().positive();
const categorySchema = z.string().uuid("Create or choose a category first.");
const prioritySchema = z.enum(taskPriorities);
const workflowStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "on_hold",
  "done",
]);

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max).optional(),
  );

const optionalMinutes = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : Number(value)),
  z.number().int().min(1).max(1440).optional(),
);

const optionalRevision = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : Number(value)),
  z.number().int().positive().optional(),
);

const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a task title.")
    .max(200, "Keep the title under 200 characters."),
  description: optionalText(2000),
  category: categorySchema,
  priority: prioritySchema,
  date: dateSchema,
  estimatedMinutes: optionalMinutes,
  anytimeWeekStart: z.preprocess(
    (value) => (value === "" ? undefined : value),
    dateSchema.optional(),
  ),
  recurrenceCount: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === "0"
        ? undefined
        : Number(value),
    z.number().int().min(1).max(7).optional(),
  ),
});

const taskRevisionSchema = z.object({
  id: idSchema,
  revision: revisionSchema,
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseTaskInput(formData: FormData) {
  return taskInputSchema.safeParse({
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    category: formValue(formData, "category"),
    priority: formValue(formData, "priority"),
    date: formValue(formData, "date"),
    estimatedMinutes: formValue(formData, "estimatedMinutes"),
    anytimeWeekStart: formValue(formData, "anytimeWeekStart"),
    recurrenceCount: formValue(formData, "recurrenceCount"),
  });
}

function resultFromError(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  if (error instanceof PlannerAuthError || error instanceof PlannerDataError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refreshPlanner() {
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/category", "layout");
  revalidatePath("/progress");
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const parsed = parseTaskInput(formData);
  if (!parsed.success) return resultFromError(parsed.error);
  const { recurrenceCount, ...taskData } = parsed.data;
  if (recurrenceCount && !taskData.anytimeWeekStart) {
    return {
      ok: false,
      error: "Weekly recurrence is available for Anytime tasks only.",
    };
  }

  try {
    await createPlannedTask(taskData, recurrenceCount);
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const parsed = parseTaskInput(formData);
  const target = taskRevisionSchema.safeParse({
    id: formValue(formData, "id"),
    revision: formValue(formData, "revision"),
  });
  if (!parsed.success) return resultFromError(parsed.error);
  if (!target.success) return resultFromError(target.error);
  const { recurrenceCount, ...taskData } = parsed.data;
  if (recurrenceCount && !taskData.anytimeWeekStart) {
    return {
      ok: false,
      error: "Weekly recurrence is available for Anytime tasks only.",
    };
  }

  try {
    await updatePlannedTask(
      target.data.id,
      target.data.revision,
      taskData,
      recurrenceCount,
    );
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function toggleTask(formData: FormData): Promise<ActionResult> {
  const target = taskRevisionSchema.safeParse({
    id: formValue(formData, "id"),
    revision: formValue(formData, "revision"),
  });
  const completed = z
    .enum(["true", "false"])
    .safeParse(formValue(formData, "completed"));
  if (!target.success) return resultFromError(target.error);
  if (!completed.success) return resultFromError(completed.error);

  try {
    await setTaskCompleted(
      target.data.id,
      target.data.revision,
      completed.data === "true",
    );
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const target = taskRevisionSchema.safeParse({
    id: formValue(formData, "id"),
    revision: formValue(formData, "revision"),
  });
  if (!target.success) return resultFromError(target.error);
  try {
    await deletePlannedTask(target.data.id, target.data.revision);
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function moveTaskToTomorrow(formData: FormData): Promise<ActionResult> {
  const target = taskRevisionSchema.safeParse({
    id: formValue(formData, "id"),
    revision: formValue(formData, "revision"),
  });
  if (!target.success) return resultFromError(target.error);
  try {
    await movePlannedTaskToTomorrow(target.data.id, target.data.revision);
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function reorderTask(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      id: idSchema,
      revision: revisionSchema,
      direction: z.enum(["up", "down"]),
    })
    .safeParse({
      id: formValue(formData, "id"),
      revision: formValue(formData, "revision"),
      direction: formValue(formData, "direction"),
    });
  if (!parsed.success) return resultFromError(parsed.error);
  try {
    await reorderPlannedTask(
      parsed.data.id,
      parsed.data.revision,
      parsed.data.direction,
    );
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function saveDailyFocus(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      date: dateSchema,
      careerMission: optionalText(500),
      contentMission: optionalText(500),
      revision: optionalRevision,
    })
    .safeParse({
      date: formValue(formData, "date"),
      careerMission: formValue(formData, "careerMission"),
      contentMission: formValue(formData, "contentMission"),
      revision: formValue(formData, "revision"),
    });
  if (!parsed.success) return resultFromError(parsed.error);
  try {
    await savePlannerDailyFocus(
      parsed.data.date,
      parsed.data.careerMission ?? "",
      parsed.data.contentMission ?? "",
      parsed.data.revision,
    );
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function setTaskWorkflow(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      id: idSchema,
      revision: revisionSchema,
      status: workflowStatusSchema,
    })
    .safeParse({
      id: formValue(formData, "id"),
      revision: formValue(formData, "revision"),
      status: formValue(formData, "status"),
    });
  if (!parsed.success) return resultFromError(parsed.error);
  try {
    await setPlannedTaskWorkflow(
      parsed.data.id,
      parsed.data.revision,
      parsed.data.status,
    );
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function confirmTaskCompletion(formData: FormData): Promise<ActionResult> {
  const target = taskRevisionSchema.safeParse({
    id: formValue(formData, "id"),
    revision: formValue(formData, "revision"),
  });
  if (!target.success) return resultFromError(target.error);
  try {
    await confirmPlannedTaskCompletion(target.data.id, target.data.revision);
    refreshPlanner();
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}
