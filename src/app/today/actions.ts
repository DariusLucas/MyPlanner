"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { addDays, format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { db } from "@/src/db/client";
import { dailyFocus, tasks } from "@/src/db/schema";
import { taskCategories, taskPriorities, taskStatuses } from "@/src/lib/today";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => isValid(parseISO(value)), "Choose a valid date.");
const idSchema = z.coerce.number().int().positive();
const categorySchema = z.enum(taskCategories);
const prioritySchema = z.enum(taskPriorities);
const statusSchema = z.enum(taskStatuses);

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(max).optional(),
);

const optionalMinutes = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : Number(value),
  z.number().int().min(1).max(1440).optional(),
);

const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Add a task title.").max(200, "Keep the title under 200 characters."),
  description: optionalText(2000),
  category: categorySchema,
  priority: prioritySchema,
  date: dateSchema,
  estimatedMinutes: optionalMinutes,
  anytimeWeekStart: z.preprocess((value) => value === "" ? undefined : value, dateSchema.optional()),
});

const taskIdSchema = z.object({ id: idSchema });
const reorderSchema = z.object({
  id: idSchema,
  date: dateSchema,
  category: categorySchema,
  direction: z.enum(["up", "down"]),
});
const workflowSchema = z.object({ id: idSchema, status: statusSchema });

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function taskInput(formData: FormData) {
  return taskInputSchema.safeParse({
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    category: formValue(formData, "category"),
    priority: formValue(formData, "priority"),
    date: formValue(formData, "date"),
    estimatedMinutes: formValue(formData, "estimatedMinutes"),
    anytimeWeekStart: formValue(formData, "anytimeWeekStart"),
  });
}

function resultFromError(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the form and try again." };
  }

  return { ok: false, error: "Something went wrong. Please try again." };
}

function nextPosition(date: string) {
  return db
    .select({ value: sql<number>`coalesce(max(${tasks.position}), -1) + 1` })
    .from(tasks)
    .where(eq(tasks.date, date))
    .get()?.value ?? 0;
}

function normalizePositions(date: string) {
  const dateTasks = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.date, date))
    .orderBy(asc(tasks.position), asc(tasks.id))
    .all();
  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    dateTasks.forEach((task, position) => {
      tx.update(tasks).set({ position, updatedAt }).where(eq(tasks.id, task.id)).run();
    });
  });
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const parsed = taskInput(formData);
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    db.insert(tasks).values({
      ...parsed.data,
      position: nextPosition(parsed.data.date),
    }).run();
    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const parsed = taskInput(formData);
  const parsedId = taskIdSchema.safeParse({ id: formValue(formData, "id") });
  if (!parsed.success) return resultFromError(parsed.error);
  if (!parsedId.success) return resultFromError(parsedId.error);

  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsedId.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };

    db.update(tasks)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, parsedId.data.id))
      .run();

    if (existing.date !== parsed.data.date) {
      normalizePositions(existing.date);
      normalizePositions(parsed.data.date);
    }

    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function toggleTask(formData: FormData): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ id: formValue(formData, "id") });
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsed.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };

    const completed = existing.status !== "completed";
    db.update(tasks)
      .set({
        status: completed ? "completed" : "not_started",
        completedAt: completed ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, parsed.data.id))
      .run();

    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ id: formValue(formData, "id") });
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsed.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };
    db.delete(tasks).where(eq(tasks.id, parsed.data.id)).run();
    normalizePositions(existing.date);
    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function moveTaskToTomorrow(formData: FormData): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ id: formValue(formData, "id") });
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsed.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };
    if (existing.status === "completed") return { ok: false, error: "Completed tasks stay on their original date." };

    const tomorrow = format(addDays(parseISO(existing.date), 1), "yyyy-MM-dd");
    db.update(tasks)
      .set({ date: tomorrow, position: nextPosition(tomorrow), updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, parsed.data.id))
      .run();
    normalizePositions(existing.date);
    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function reorderTask(formData: FormData): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse({
    id: formValue(formData, "id"),
    date: formValue(formData, "date"),
    category: formValue(formData, "category"),
    direction: formValue(formData, "direction"),
  });
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    const dateTasks = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.date, parsed.data.date), eq(tasks.category, parsed.data.category)))
      .orderBy(asc(tasks.position), asc(tasks.id))
      .all();
    const index = dateTasks.findIndex((task) => task.id === parsed.data.id);
    const nextIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= dateTasks.length) return { ok: true };

    [dateTasks[index], dateTasks[nextIndex]] = [dateTasks[nextIndex], dateTasks[index]];
    const updatedAt = new Date().toISOString();
    db.transaction((tx) => {
      dateTasks.forEach((task, position) => {
        tx.update(tasks).set({ position, updatedAt }).where(eq(tasks.id, task.id)).run();
      });
    });

    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

const focusSchema = z.object({
  date: dateSchema,
  careerMission: optionalText(500),
  contentMission: optionalText(500),
});

export async function saveDailyFocus(formData: FormData): Promise<ActionResult> {
  const parsed = focusSchema.safeParse({
    date: formValue(formData, "date"),
    careerMission: formValue(formData, "careerMission"),
    contentMission: formValue(formData, "contentMission"),
  });
  if (!parsed.success) return resultFromError(parsed.error);

  try {
    const updatedAt = new Date().toISOString();
    db.insert(dailyFocus)
      .values({ ...parsed.data, updatedAt })
      .onConflictDoUpdate({
        target: dailyFocus.date,
        set: {
          careerMission: parsed.data.careerMission ?? null,
          contentMission: parsed.data.contentMission ?? null,
          updatedAt,
        },
      })
      .run();

    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function setTaskWorkflow(formData: FormData): Promise<ActionResult> {
  const parsed = workflowSchema.safeParse({ id: formValue(formData, "id"), status: formValue(formData, "status") });
  if (!parsed.success) return resultFromError(parsed.error);
  if (parsed.data.status === "completed") return { ok: false, error: "Confirm completion from Done." };

  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsed.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };
    db.update(tasks).set({ status: parsed.data.status, completedAt: null, updatedAt: new Date().toISOString() }).where(eq(tasks.id, existing.id)).run();
    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}

export async function confirmTaskCompletion(formData: FormData): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse({ id: formValue(formData, "id") });
  if (!parsed.success) return resultFromError(parsed.error);
  try {
    const existing = db.select().from(tasks).where(eq(tasks.id, parsed.data.id)).limit(1).get();
    if (!existing) return { ok: false, error: "That task no longer exists." };
    if (existing.status !== "done") return { ok: false, error: "Move the task to Done before confirming completion." };
    db.update(tasks).set({ status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(tasks.id, existing.id)).run();
    revalidatePath("/week");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return resultFromError(error);
  }
}
