import { asc } from "drizzle-orm";
import { db } from "@/src/db/client";
import { tasks } from "@/src/db/schema";
import {
  calculateProgress,
  type ProgressOptions,
  type ProgressTask,
} from "@/src/lib/progress";

export function getProgressTaskHistory(): ProgressTask[] {
  return db
    .select({
      id: tasks.id,
      category: tasks.category,
      date: tasks.date,
      anytimeWeekStart: tasks.anytimeWeekStart,
      recurrenceId: tasks.recurrenceId,
      status: tasks.status,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .orderBy(asc(tasks.id))
    .all();
}

export function getProgressData(options: ProgressOptions = {}) {
  return calculateProgress(getProgressTaskHistory(), options);
}
