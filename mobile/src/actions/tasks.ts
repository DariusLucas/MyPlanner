import { isValid, parseISO } from "date-fns";
import { z } from "zod";
import { taskCategories, taskPriorities } from "@/src/lib/planner-values";
import {
  confirmPlannedTaskCompletion,
  createPlannedTask,
  deletePlannedTask,
  movePlannedTaskToTomorrow,
  reorderPlannedTask,
  savePlannerDailyFocus,
  setPlannedTaskWorkflow,
  setTaskCompleted,
  updatePlannedTask,
} from "../repository";
import { MobileAuthError, MobileDataError } from "../supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((entry) => isValid(parseISO(entry)), "Choose a valid date.");
const idSchema = z.string().uuid();
const revisionSchema = z.coerce.number().int().positive();
const optionalText = (max: number) => z.preprocess(
  (entry) => typeof entry === "string" && entry.trim() === "" ? undefined : entry,
  z.string().trim().max(max).optional(),
);
const taskSchema = z.object({
  title: z.string().trim().min(1, "Add a task title.").max(200, "Keep the title under 200 characters."),
  description: optionalText(2000),
  category: z.enum(taskCategories),
  priority: z.enum(taskPriorities),
  date: dateSchema,
  estimatedMinutes: z.preprocess((entry) => entry === "" || entry === undefined ? undefined : Number(entry), z.number().int().min(1).max(1440).optional()),
  anytimeWeekStart: z.preprocess((entry) => entry === "" ? undefined : entry, dateSchema.optional()),
  recurrenceCount: z.preprocess((entry) => entry === "" || entry === undefined || entry === "0" ? undefined : Number(entry), z.number().int().min(1).max(7).optional()),
});

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function taskInput(form: FormData) {
  return taskSchema.safeParse({
    title: value(form, "title"), description: value(form, "description"),
    category: value(form, "category"), priority: value(form, "priority"),
    date: value(form, "date"), estimatedMinutes: value(form, "estimatedMinutes"),
    anytimeWeekStart: value(form, "anytimeWeekStart"), recurrenceCount: value(form, "recurrenceCount"),
  });
}

function target(form: FormData) {
  return z.object({ id: idSchema, revision: revisionSchema }).safeParse({
    id: value(form, "id"), revision: value(form, "revision"),
  });
}

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form and try again." };
  if (error instanceof MobileAuthError || error instanceof MobileDataError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Check your connection and try again." };
}

export async function createTask(form: FormData): Promise<ActionResult> {
  const parsed = taskInput(form);
  if (!parsed.success) return failure(parsed.error);
  const { recurrenceCount, ...data } = parsed.data;
  if (recurrenceCount && !data.anytimeWeekStart) return { ok: false, error: "Weekly recurrence is available for Anytime tasks only." };
  try { await createPlannedTask(data, recurrenceCount); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function updateTask(form: FormData): Promise<ActionResult> {
  const parsed = taskInput(form); const parsedTarget = target(form);
  if (!parsed.success) return failure(parsed.error);
  if (!parsedTarget.success) return failure(parsedTarget.error);
  const { recurrenceCount, ...data } = parsed.data;
  if (recurrenceCount && !data.anytimeWeekStart) return { ok: false, error: "Weekly recurrence is available for Anytime tasks only." };
  try { await updatePlannedTask(parsedTarget.data.id, parsedTarget.data.revision, data, recurrenceCount); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function toggleTask(form: FormData): Promise<ActionResult> {
  const parsedTarget = target(form);
  const completed = z.enum(["true", "false"]).safeParse(value(form, "completed"));
  if (!parsedTarget.success) return failure(parsedTarget.error);
  if (!completed.success) return failure(completed.error);
  try { await setTaskCompleted(parsedTarget.data.id, parsedTarget.data.revision, completed.data === "true"); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function deleteTask(form: FormData): Promise<ActionResult> {
  const parsed = target(form); if (!parsed.success) return failure(parsed.error);
  try { await deletePlannedTask(parsed.data.id, parsed.data.revision); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function moveTaskToTomorrow(form: FormData): Promise<ActionResult> {
  const parsed = target(form); if (!parsed.success) return failure(parsed.error);
  try { await movePlannedTaskToTomorrow(parsed.data.id, parsed.data.revision); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function reorderTask(form: FormData): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, revision: revisionSchema, direction: z.enum(["up", "down"]) }).safeParse({
    id: value(form, "id"), revision: value(form, "revision"), direction: value(form, "direction"),
  });
  if (!parsed.success) return failure(parsed.error);
  try { await reorderPlannedTask(parsed.data.id, parsed.data.revision, parsed.data.direction); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function setTaskWorkflow(form: FormData): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, revision: revisionSchema, status: z.enum(["not_started", "in_progress", "on_hold", "done"]) }).safeParse({
    id: value(form, "id"), revision: value(form, "revision"), status: value(form, "status"),
  });
  if (!parsed.success) return failure(parsed.error);
  try { await setPlannedTaskWorkflow(parsed.data.id, parsed.data.revision, parsed.data.status); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function confirmTaskCompletion(form: FormData): Promise<ActionResult> {
  const parsed = target(form); if (!parsed.success) return failure(parsed.error);
  try { await confirmPlannedTaskCompletion(parsed.data.id, parsed.data.revision); return { ok: true }; }
  catch (error) { return failure(error); }
}

export async function saveDailyFocus(form: FormData): Promise<ActionResult> {
  const parsed = z.object({
    date: dateSchema, careerMission: optionalText(500), contentMission: optionalText(500),
    revision: z.preprocess((entry) => entry === "" || entry === undefined ? undefined : Number(entry), z.number().int().positive().optional()),
  }).safeParse({
    date: value(form, "date"), careerMission: value(form, "careerMission"),
    contentMission: value(form, "contentMission"), revision: value(form, "revision"),
  });
  if (!parsed.success) return failure(parsed.error);
  try { await savePlannerDailyFocus(parsed.data.date, parsed.data.careerMission ?? "", parsed.data.contentMission ?? "", parsed.data.revision); return { ok: true }; }
  catch (error) { return failure(error); }
}
