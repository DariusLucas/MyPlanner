import { addDays, format, parseISO } from "date-fns";
import type { TaskStatus } from "@/src/lib/today";

export type DailyCompletion = {
  date: string;
  completed: number;
  planned: number;
  remaining: number;
  percentage: number;
};

export type DailyCompletionTask = {
  date: string;
  anytimeWeekStart: string | null;
  status: TaskStatus;
};

export function buildWeekCompletion(
  tasks: DailyCompletionTask[],
  weekStart: string,
): DailyCompletion[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    const plannedTasks = tasks.filter(
      (task) => task.date === date && !task.anytimeWeekStart,
    );
    const completed = plannedTasks.filter(
      (task) => task.status === "completed",
    ).length;
    const planned = plannedTasks.length;
    return {
      date,
      completed,
      planned,
      remaining: Math.max(0, planned - completed),
      percentage: planned ? Math.round((completed / planned) * 100) : 0,
    };
  });
}
