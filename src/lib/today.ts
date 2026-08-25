import { asc, eq } from "drizzle-orm";
import { format, isValid, parseISO } from "date-fns";
import { db } from "@/src/db/client";
import { dailyFocus, tasks } from "@/src/db/schema";

export const taskCategories = ["career", "content", "other"] as const;
export const taskPriorities = ["high", "normal", "low"] as const;
export const taskStatuses = ["not_started", "in_progress", "on_hold", "done", "completed", "skipped"] as const;

export type TaskCategory = (typeof taskCategories)[number];
export type TaskPriority = (typeof taskPriorities)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type PlannerId = string | number;

type SqliteTask = typeof tasks.$inferSelect;
type SqliteDailyFocus = typeof dailyFocus.$inferSelect;

export type TodayTask = Omit<
  SqliteTask,
  "id" | "goalId" | "sprintId" | "sprintWeekId" | "recurrenceId"
> & {
  id: PlannerId;
  goalId: PlannerId | null;
  sprintId: PlannerId | null;
  sprintWeekId: PlannerId | null;
  recurrenceId: PlannerId | null;
  revision?: number;
};

export type DailyFocus = Omit<SqliteDailyFocus, "id"> & {
  id: PlannerId;
  revision?: number;
};

export type TodayData = {
  date: string;
  focus: DailyFocus | undefined;
  tasks: TodayTask[];
  categories: Record<TaskCategory, { total: number; completed: number }>;
  total: number;
  completed: number;
};

export function currentDateValue() {
  return format(new Date(), "yyyy-MM-dd");
}

export function normalizeDateValue(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && isValid(parseISO(candidate))) {
    return candidate;
  }

  return currentDateValue();
}

export function getTodayData(date: string): TodayData {
  const focus = db.select().from(dailyFocus).where(eq(dailyFocus.date, date)).limit(1).get();
  const todayTasks = db
    .select()
    .from(tasks)
    .where(eq(tasks.date, date))
    .orderBy(asc(tasks.position), asc(tasks.id))
    .all();

  const categories = Object.fromEntries(
    taskCategories.map((category) => {
      const categoryTasks = todayTasks.filter((task) => task.category === category);
      return [category, {
        total: categoryTasks.length,
        completed: categoryTasks.filter((task) => task.status === "completed").length,
      }];
    }),
  ) as Record<TaskCategory, { total: number; completed: number }>;

  return {
    date,
    focus,
    tasks: todayTasks,
    categories,
    total: todayTasks.length,
    completed: todayTasks.filter((task) => task.status === "completed").length,
  };
}
