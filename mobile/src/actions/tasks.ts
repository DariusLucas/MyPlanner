import { addDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import {
  allTasks,
  changed,
  query,
  run,
  taskById,
  transaction,
  type MobileTask,
} from "../database";
import { ensureRecurringInstances } from "../recurrence";

export type ActionResult = { ok: true } | { ok: false; error: string };

const categories = ["career", "content", "other"] as const;
const priorities = ["high", "normal", "low"] as const;
const statuses = ["not_started", "in_progress", "on_hold", "done", "completed", "skipped"] as const;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => isValid(parseISO(value)), "Choose a valid date.");
const idSchema = z.coerce.number().int().positive();
const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(max).optional(),
);
const taskSchema = z.object({
  title: z.string().trim().min(1, "Add a task title.").max(200, "Keep the title under 200 characters."),
  description: optionalText(2000),
  category: z.enum(categories),
  priority: z.enum(priorities),
  date: dateSchema,
  estimatedMinutes: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : Number(value),
    z.number().int().min(1).max(1440).optional(),
  ),
  anytimeWeekStart: z.preprocess((value) => value === "" ? undefined : value, dateSchema.optional()),
  recurrenceCount: z.preprocess(
    (value) => value === "" || value === undefined || value === "0" ? undefined : Number(value),
    z.number().int().min(1).max(7).optional(),
  ),
});

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function taskInput(form: FormData) {
  return taskSchema.safeParse({
    title: value(form, "title"),
    description: value(form, "description"),
    category: value(form, "category"),
    priority: value(form, "priority"),
    date: value(form, "date"),
    estimatedMinutes: value(form, "estimatedMinutes"),
    anytimeWeekStart: value(form, "anytimeWeekStart"),
    recurrenceCount: value(form, "recurrenceCount"),
  });
}

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form and try again." };
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function nextPosition(date: string) {
  const [row] = await query<{ value: number }>("SELECT coalesce(max(position), -1) + 1 AS value FROM tasks WHERE date = ?", [date]);
  return row?.value ?? 0;
}

async function normalizePositions(date: string) {
  const rows = await query<{ id: number }>("SELECT id FROM tasks WHERE date = ? ORDER BY position, id", [date]);
  const now = new Date().toISOString();
  await transaction(async () => {
    for (const [position, task] of rows.entries()) {
      await run("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?", [position, now, task.id]);
    }
  });
}

async function insertTask(data: z.infer<typeof taskSchema>, recurrenceId: number | null = null, recurrenceIndex: number | null = null) {
  const now = new Date().toISOString();
  const date = data.anytimeWeekStart ?? data.date;
  return run(
    `INSERT INTO tasks (
      title, description, category, date, anytime_week_start, recurrence_id,
      recurrence_week_start, recurrence_index, priority, position,
      estimated_minutes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.description ?? null,
      data.category,
      date,
      data.anytimeWeekStart ?? null,
      recurrenceId,
      recurrenceId ? data.anytimeWeekStart ?? null : null,
      recurrenceIndex,
      data.priority,
      await nextPosition(date),
      data.estimatedMinutes ?? null,
      now,
      now,
    ],
  );
}

export async function createTask(form: FormData): Promise<ActionResult> {
  const parsed = taskInput(form);
  if (!parsed.success) return failure(parsed.error);
  try {
    const data = parsed.data;
    if (data.recurrenceCount && !data.anytimeWeekStart) {
      return { ok: false, error: "Weekly recurrence is available for Anytime tasks only." };
    }
    if (!data.recurrenceCount) {
      await insertTask(data);
      return { ok: true };
    }
    await transaction(async () => {
      const now = new Date().toISOString();
      const recurrence = await run(
        `INSERT INTO task_recurrences (
          title, description, category, priority, estimated_minutes,
          count_per_week, start_week, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [data.title, data.description ?? null, data.category, data.priority, data.estimatedMinutes ?? null, data.recurrenceCount!, data.anytimeWeekStart!, now, now],
      );
      const recurrenceId = recurrence.changes?.lastId;
      if (!recurrenceId) throw new Error("The recurring task could not be created.");
      for (let index = 0; index < data.recurrenceCount!; index += 1) {
        await insertTask(data, recurrenceId, index);
      }
    });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTask(form: FormData): Promise<ActionResult> {
  const parsed = taskInput(form);
  const id = idSchema.safeParse(value(form, "id"));
  if (!parsed.success) return failure(parsed.error);
  if (!id.success) return failure(id.error);
  try {
    const existing = await taskById(id.data);
    if (!existing) return { ok: false, error: "That task no longer exists." };
    const data = parsed.data;
    if (data.recurrenceCount && !data.anytimeWeekStart) {
      return { ok: false, error: "Weekly recurrence is available for Anytime tasks only." };
    }
    const now = new Date().toISOString();
    await transaction(async () => {
      if (existing.recurrenceId && !data.recurrenceCount) {
        await run("UPDATE task_recurrences SET active = 0, updated_at = ? WHERE id = ?", [now, existing.recurrenceId]);
        await run("DELETE FROM tasks WHERE recurrence_id = ? AND id <> ? AND status NOT IN ('completed', 'skipped')", [existing.recurrenceId, existing.id]);
      } else if (existing.recurrenceId && data.recurrenceCount) {
        await run(
          `UPDATE task_recurrences SET title = ?, description = ?, category = ?, priority = ?,
           estimated_minutes = ?, count_per_week = ?, updated_at = ? WHERE id = ?`,
          [data.title, data.description ?? null, data.category, data.priority, data.estimatedMinutes ?? null, data.recurrenceCount, now, existing.recurrenceId],
        );
        await run(
          `UPDATE tasks SET title = ?, description = ?, category = ?, priority = ?, estimated_minutes = ?, updated_at = ?
           WHERE recurrence_id = ? AND status NOT IN ('completed', 'skipped')`,
          [data.title, data.description ?? null, data.category, data.priority, data.estimatedMinutes ?? null, now, existing.recurrenceId],
        );
      }

      let recurrenceId = existing.recurrenceId;
      if (!existing.recurrenceId && data.recurrenceCount) {
        const recurrence = await run(
          `INSERT INTO task_recurrences (title, description, category, priority, estimated_minutes,
           count_per_week, start_week, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [data.title, data.description ?? null, data.category, data.priority, data.estimatedMinutes ?? null, data.recurrenceCount, data.anytimeWeekStart!, now, now],
        );
        recurrenceId = recurrence.changes?.lastId ?? null;
      }

      const recurrenceActive = Boolean(recurrenceId && data.recurrenceCount);
      const nextDate = data.anytimeWeekStart ?? data.date;
      await run(
        `UPDATE tasks SET title = ?, description = ?, category = ?, date = ?, anytime_week_start = ?,
         recurrence_id = ?, recurrence_week_start = ?, recurrence_index = ?, priority = ?, estimated_minutes = ?, updated_at = ?
         WHERE id = ?`,
        [data.title, data.description ?? null, data.category, nextDate, data.anytimeWeekStart ?? null,
          recurrenceActive ? recurrenceId : null, recurrenceActive ? data.anytimeWeekStart! : null,
          recurrenceActive ? existing.recurrenceIndex ?? 0 : null, data.priority, data.estimatedMinutes ?? null, now, existing.id],
      );
    });
    if (existing.date !== (parsed.data.anytimeWeekStart ?? parsed.data.date)) {
      await normalizePositions(existing.date);
      await normalizePositions(parsed.data.anytimeWeekStart ?? parsed.data.date);
    }
    if (parsed.data.recurrenceCount && parsed.data.anytimeWeekStart) {
      await ensureRecurringInstances(parsed.data.anytimeWeekStart);
    }
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleTask(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return failure(id.error);
  try {
    const task = await taskById(id.data);
    if (!task) return { ok: false, error: "That task no longer exists." };
    const completed = task.status !== "completed";
    const now = new Date().toISOString();
    await run("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?", [completed ? "completed" : "not_started", completed ? now : null, now, task.id]);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTask(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return failure(id.error);
  try {
    const task = await taskById(id.data);
    if (!task) return { ok: false, error: "That task no longer exists." };
    if (task.recurrenceId) {
      await transaction(async () => {
        await run("UPDATE task_recurrences SET active = 0, updated_at = ? WHERE id = ?", [new Date().toISOString(), task.recurrenceId]);
        await run("DELETE FROM tasks WHERE recurrence_id = ? AND status NOT IN ('completed', 'skipped')", [task.recurrenceId]);
      });
    } else {
      await run("DELETE FROM tasks WHERE id = ?", [task.id]);
    }
    await normalizePositions(task.date);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function moveTaskToTomorrow(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return failure(id.error);
  try {
    const task = await taskById(id.data);
    if (!task) return { ok: false, error: "That task no longer exists." };
    if (task.status === "completed") return { ok: false, error: "Completed tasks stay on their original date." };
    const tomorrow = format(addDays(parseISO(task.date), 1), "yyyy-MM-dd");
    await run("UPDATE tasks SET date = ?, position = ?, updated_at = ? WHERE id = ?", [tomorrow, await nextPosition(tomorrow), new Date().toISOString(), task.id]);
    await normalizePositions(task.date);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function reorderTask(form: FormData): Promise<ActionResult> {
  const parsed = z.object({
    id: idSchema,
    date: dateSchema,
    category: z.enum(categories),
    direction: z.enum(["up", "down"]),
  }).safeParse({ id: value(form, "id"), date: value(form, "date"), category: value(form, "category"), direction: value(form, "direction") });
  if (!parsed.success) return failure(parsed.error);
  try {
    const tasks = await allTasks("date = ? AND category = ?", [parsed.data.date, parsed.data.category], "position, id");
    const index = tasks.findIndex((task) => task.id === parsed.data.id);
    const nextIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= tasks.length) return { ok: true };
    [tasks[index], tasks[nextIndex]] = [tasks[nextIndex]!, tasks[index]!];
    const now = new Date().toISOString();
    await transaction(async () => {
      for (const [position, task] of tasks.entries()) await run("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?", [position, now, task.id]);
    });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setTaskWorkflow(form: FormData): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, status: z.enum(statuses) }).safeParse({ id: value(form, "id"), status: value(form, "status") });
  if (!parsed.success) return failure(parsed.error);
  if (parsed.data.status === "completed") return { ok: false, error: "Confirm completion from Done." };
  try {
    const result = await run("UPDATE tasks SET status = ?, completed_at = NULL, updated_at = ? WHERE id = ?", [parsed.data.status, new Date().toISOString(), parsed.data.id]);
    return changed(result) ? { ok: true } : { ok: false, error: "That task no longer exists." };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmTaskCompletion(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return failure(id.error);
  try {
    const task = await taskById(id.data);
    if (!task) return { ok: false, error: "That task no longer exists." };
    if (task.status !== "done") return { ok: false, error: "Move the task to Done before confirming completion." };
    const now = new Date().toISOString();
    await run("UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?", [now, now, task.id]);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDailyFocus(form: FormData): Promise<ActionResult> {
  const parsed = z.object({ date: dateSchema, careerMission: optionalText(500), contentMission: optionalText(500) }).safeParse({
    date: value(form, "date"), careerMission: value(form, "careerMission"), contentMission: value(form, "contentMission"),
  });
  if (!parsed.success) return failure(parsed.error);
  try {
    const now = new Date().toISOString();
    await run(
      `INSERT INTO daily_focus(date, career_mission, content_mission, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET career_mission = excluded.career_mission,
       content_mission = excluded.content_mission, updated_at = excluded.updated_at`,
      [parsed.data.date, parsed.data.careerMission ?? null, parsed.data.contentMission ?? null, now],
    );
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export type { MobileTask };
