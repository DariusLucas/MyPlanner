import { and, asc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import { addDays, addWeeks, endOfWeek, format, isValid, parseISO, startOfWeek } from "date-fns";
import { db } from "@/src/db/client";
import { tasks } from "@/src/db/schema";
import type { TodayTask } from "@/src/lib/today";

export type WeekData = {
  weekStart: string;
  weekEnd: string;
  days: { date: string; tasks: TodayTask[] }[];
  anytime: TodayTask[];
  overdue: TodayTask[];
  completed: TodayTask[];
};

export function currentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function normalizeWeekStart(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && isValid(parseISO(candidate))) {
    return format(startOfWeek(parseISO(candidate), { weekStartsOn: 1 }), "yyyy-MM-dd");
  }
  return currentWeekStart();
}

export function weekHref(start: string, offset: number) {
  return format(addWeeks(parseISO(start), offset), "yyyy-MM-dd");
}

export function getWeekData(weekStart: string): WeekData {
  const weekEnd = format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const incomplete = ne(tasks.status, "completed");
  const active = db.select().from(tasks).where(and(or(lte(tasks.anytimeWeekStart, weekStart), and(isNull(tasks.anytimeWeekStart), lte(tasks.date, weekEnd))), incomplete)).orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id)).all();
  const completed = db.select().from(tasks).where(and(eq(tasks.status, "completed"), or(and(gte(tasks.date, weekStart), lte(tasks.date, weekEnd)), eq(tasks.anytimeWeekStart, weekStart)))).orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id)).all();
  const anytime = [...active, ...completed]
    .filter((task) => task.anytimeWeekStart === weekStart)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    return { date, tasks: [...active.filter((task) => !task.anytimeWeekStart && task.date === date), ...completed.filter((task) => !task.anytimeWeekStart && task.date === date)] };
  });
  return {
    weekStart,
    weekEnd,
    days,
    anytime,
    overdue: active.filter((task) => task.anytimeWeekStart ? task.anytimeWeekStart < weekStart : task.date < weekStart),
    completed,
  };
}
