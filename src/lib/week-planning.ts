import { eq, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { taskRecurrences, tasks } from "@/src/db/schema";
import { ensureRecurringInstances } from "@/src/lib/recurrence";
import type { TaskCategory, TaskPriority } from "@/src/lib/today";

export type PlannedTaskInput = {
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  date: string;
  estimatedMinutes?: number;
  anytimeWeekStart?: string;
};

function nextPosition(date: string) {
  return (
    db
      .select({ value: sql<number>`coalesce(max(${tasks.position}), -1) + 1` })
      .from(tasks)
      .where(eq(tasks.date, date))
      .get()?.value ?? 0
  );
}

/**
 * Persist a task created from a weekly planning surface. Keeping this database
 * operation outside the server action makes week-planning behavior directly
 * testable without coupling tests to Next's request lifecycle.
 */
export function persistPlannedTask(
  taskData: PlannedTaskInput,
  recurrenceCount?: number,
) {
  if (recurrenceCount) {
    const recurrence = db
      .insert(taskRecurrences)
      .values({
        title: taskData.title,
        description: taskData.description,
        category: taskData.category,
        priority: taskData.priority,
        estimatedMinutes: taskData.estimatedMinutes,
        countPerWeek: recurrenceCount,
        startWeek: taskData.anytimeWeekStart!,
      })
      .returning({ id: taskRecurrences.id })
      .get();
    ensureRecurringInstances(taskData.anytimeWeekStart!);
    return { recurrenceId: recurrence.id, taskId: null };
  }

  const task = db
    .insert(tasks)
    .values({
      ...taskData,
      position: nextPosition(taskData.date),
    })
    .returning({ id: tasks.id })
    .get();
  return { recurrenceId: null, taskId: task.id };
}
