import { and, asc, desc, eq, gt, gte, isNull, lt, lte, notInArray, or } from "drizzle-orm";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/src/db/client";
import { quickThoughts, tasks } from "@/src/db/schema";
import { ensureRecurringInstances } from "@/src/lib/recurrence";
import { calculateProductiveStreak } from "@/src/lib/progress";
import { buildWeekCompletion, type DailyCompletion } from "@/src/lib/daily-completion";
import type { PlannerId, TodayTask } from "@/src/lib/today";

export type QuickThought = Omit<typeof quickThoughts.$inferSelect, "id"> & {
  id: PlannerId;
  revision?: number;
};
export type StreakState = "hot" | "cooling" | "cold";

export type DashboardData = {
  date: string;
  active: TodayTask[];
  overdue: TodayTask[];
  completedToday: TodayTask[];
  counts: { completed: number; remaining: number; planned: number };
  weekCompletion: DailyCompletion[];
  streak: {
    current: number;
    best: number;
    state: StreakState;
    graceDaysUsed: number;
  };
  recentThoughts: QuickThought[];
  allThoughts: QuickThought[];
};

export function localDate(now = new Date()) {
  return format(now, "yyyy-MM-dd");
}

export function localDayBounds(date: string) {
  const day = parseISO(date);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function calculateStreak(completionDates: string[], today: string) {
  const { current, best, graceDaysUsed } = calculateProductiveStreak(completionDates, today);
  return {
    current,
    best,
    state: graceDaysUsed === 0 ? "hot" as const : graceDaysUsed === 1 ? "cooling" as const : "cold" as const,
    graceDaysUsed,
  };
}

export function getDashboardData(now = new Date()): DashboardData {
  const date = localDate(now);
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  ensureRecurringInstances(weekStart, weekStart);
  const incomplete = notInArray(tasks.status, ["completed", "skipped"]);
  const active = db.select().from(tasks).where(and(
    or(
      and(eq(tasks.date, date), isNull(tasks.anytimeWeekStart)),
      eq(tasks.anytimeWeekStart, weekStart),
    ),
    incomplete,
  )).orderBy(asc(tasks.position), asc(tasks.id)).all();
  const overdue = db.select().from(tasks).where(and(
    or(
      and(lt(tasks.date, date), isNull(tasks.anytimeWeekStart)),
      lt(tasks.anytimeWeekStart, weekStart),
    ),
    incomplete,
  )).orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id)).all();
  const bounds = localDayBounds(date);
  const completedToday = db.select().from(tasks).where(and(
    eq(tasks.status, "completed"),
    gte(tasks.completedAt, bounds.start),
    lt(tasks.completedAt, bounds.end),
  )).orderBy(desc(tasks.completedAt), desc(tasks.id)).all();
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const weekTasks = db.select({
    date: tasks.date,
    anytimeWeekStart: tasks.anytimeWeekStart,
    status: tasks.status,
  }).from(tasks).where(and(gte(tasks.date, weekStart), lte(tasks.date, weekEnd))).all();
  const completionDates = db.select({ completedAt: tasks.completedAt }).from(tasks)
    .where(and(eq(tasks.status, "completed"), gt(tasks.completedAt, "")))
    .orderBy(asc(tasks.completedAt)).all()
    .flatMap(({ completedAt }) => completedAt ? [localDate(new Date(completedAt))] : []);
  const allThoughts = db.select().from(quickThoughts)
    .orderBy(desc(quickThoughts.createdAt), desc(quickThoughts.id)).all();
  const remaining = active.length + overdue.length;

  return {
    date,
    active,
    overdue,
    completedToday,
    counts: {
      completed: completedToday.length,
      remaining,
      planned: remaining + completedToday.length,
    },
    weekCompletion: buildWeekCompletion(weekTasks, weekStart),
    streak: calculateStreak(completionDates, date),
    recentThoughts: allThoughts.slice(0, 3),
    allThoughts,
  };
}
