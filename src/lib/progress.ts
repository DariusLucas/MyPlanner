import { asc } from "drizzle-orm";
import { db } from "@/src/db/client";
import { tasks } from "@/src/db/schema";
import type { TaskCategory, TaskStatus } from "@/src/lib/today";

export const progressCategoryKeys = ["career", "content", "personal"] as const;
export type ProgressCategory = (typeof progressCategoryKeys)[number];

export const weekdayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type WeekdayKey = (typeof weekdayKeys)[number];

export type ProgressTask = {
  id?: number;
  category: TaskCategory;
  date: string;
  anytimeWeekStart: string | null;
  recurrenceId?: number | null;
  status: TaskStatus;
  completedAt: string | null;
};

export type ProgressOptions = {
  /** Inclusive local calendar date. Defaults to the beginning of history. */
  startDate?: string;
  /** Inclusive local calendar date. Future dates are capped at today. */
  endDate?: string;
  /** Local calendar date used to exclude work that is not due yet. */
  today?: string;
  /** IANA timezone used to turn persisted completion instants into local dates. */
  timeZone?: string;
  /** Optional Progress-facing category filter. */
  category?: ProgressCategory;
};

export type DailyProgress = {
  date: string;
  completed: number;
  productive: boolean;
  planned: number;
  plannedCompleted: number;
  completionRate: number;
  categoryCounts: Record<ProgressCategory, number>;
};

export type ProgressData = {
  range: { startDate: string | null; endDate: string; timeZone: string };
  completedTasks: number;
  productiveDays: number;
  currentStreak: number;
  bestStreak: number;
  graceDaysUsed: number;
  tasksPlanned: number;
  plannedTasksCompleted: number;
  completionRate: number;
  overdueCompletions: number;
  categoryCounts: Record<ProgressCategory, number>;
  weekdayDistribution: Record<WeekdayKey, number>;
  completionDates: Record<string, number>;
  daily: DailyProgress[];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function dateNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function validDate(date: string | undefined): date is string {
  if (!date || !datePattern.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function addDays(date: string, days: number) {
  return new Date(dateNumber(date) + days * 86_400_000).toISOString().slice(0, 10);
}

function calendarDayDifference(later: string, earlier: string) {
  return Math.round((dateNumber(later) - dateNumber(earlier)) / 86_400_000);
}

export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function localDateInTimeZone(
  value: Date | string = new Date(),
  timeZone = systemTimeZone(),
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localDate = `${values.year}-${values.month}-${values.day}`;
  return validDate(localDate) ? localDate : null;
}

export function calculateProductiveStreak(completionDates: string[], today: string) {
  const dates = [...new Set(completionDates.filter(validDate))]
    .filter((date) => date <= today)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | undefined;

  for (const date of dates) {
    const gap = previous
      ? calendarDayDifference(date, previous)
      : Number.POSITIVE_INFINITY;
    run = !previous || gap > 3 ? 1 : run + 1;
    best = Math.max(best, run);
    previous = date;
  }

  if (!previous) {
    return { current: 0, best: 0, graceDaysUsed: 0 };
  }

  const gapToToday = calendarDayDifference(today, previous);
  if (gapToToday > 3) {
    return { current: 0, best, graceDaysUsed: 0 };
  }

  return {
    current: run,
    best,
    graceDaysUsed: Math.max(0, gapToToday - 1),
  };
}

function emptyCategories(): Record<ProgressCategory, number> {
  return { career: 0, content: 0, personal: 0 };
}

function emptyWeekdays(): Record<WeekdayKey, number> {
  return {
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  };
}

function progressCategory(category: TaskCategory): ProgressCategory {
  return category === "other" ? "personal" : category;
}

function weekday(date: string): WeekdayKey {
  const sundayFirst = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return weekdayKeys[(sundayFirst + 6) % 7]!;
}

function inRange(date: string, startDate: string | undefined, endDate: string) {
  return (!startDate || date >= startDate) && date <= endDate;
}

/**
 * Calculate the persisted-task progress contract without mutating task history.
 * Each recurring task instance is an ordinary planned item; skipped instances
 * remain in the planned denominator but never count as completed.
 */
export function calculateProgress(
  taskHistory: ProgressTask[],
  options: ProgressOptions = {},
): ProgressData {
  const timeZone = options.timeZone ?? systemTimeZone();
  // Constructing the formatter here validates the timezone even for empty data.
  new Intl.DateTimeFormat("en-US", { timeZone }).format();

  const today = validDate(options.today)
    ? options.today
    : localDateInTimeZone(new Date(), timeZone)!;
  const startDate = validDate(options.startDate) ? options.startDate : undefined;
  const requestedEnd = validDate(options.endDate) ? options.endDate : today;
  const endDate = requestedEnd < today ? requestedEnd : today;
  const effectiveStart = startDate;
  const categoryCounts = emptyCategories();
  const weekdayDistribution = emptyWeekdays();
  const completionDates: Record<string, number> = {};
  const daily = new Map<string, DailyProgress>();
  const allCompletionDates: string[] = [];
  let overdueCompletions = 0;
  const selectedHistory = options.category
    ? taskHistory.filter((task) => progressCategory(task.category) === options.category)
    : taskHistory;

  function day(date: string) {
    const existing = daily.get(date);
    if (existing) return existing;
    const point: DailyProgress = {
      date,
      completed: 0,
      productive: false,
      planned: 0,
      plannedCompleted: 0,
      completionRate: 0,
      categoryCounts: emptyCategories(),
    };
    daily.set(date, point);
    return point;
  }

  const completed = selectedHistory.flatMap((task) => {
    if (task.status !== "completed" || !task.completedAt) return [];
    const completedDate = localDateInTimeZone(task.completedAt, timeZone);
    if (!completedDate || completedDate > today) return [];
    allCompletionDates.push(completedDate);
    return [{ task, completedDate }];
  });

  const rangedCompletions = completed.filter(({ completedDate }) =>
    inRange(completedDate, effectiveStart, endDate),
  );

  for (const { task, completedDate } of rangedCompletions) {
    const category = progressCategory(task.category);
    categoryCounts[category] += 1;
    weekdayDistribution[weekday(completedDate)] += 1;
    completionDates[completedDate] = (completionDates[completedDate] ?? 0) + 1;
    const dailyPoint = day(completedDate);
    dailyPoint.completed += 1;
    dailyPoint.productive = true;
    dailyPoint.categoryCounts[category] += 1;

    if (validDate(task.date)) {
      const deadline = task.anytimeWeekStart && validDate(task.anytimeWeekStart)
        ? addDays(task.anytimeWeekStart, 6)
        : task.date;
      if (completedDate > deadline) overdueCompletions += 1;
    }
  }

  const planned = selectedHistory.filter((task) =>
    validDate(task.date) && inRange(task.date, effectiveStart, endDate),
  );
  let plannedTasksCompleted = 0;
  for (const task of planned) {
    const dailyPoint = day(task.date);
    dailyPoint.planned += 1;
    if (task.status !== "completed" || !task.completedAt) continue;
    const completedDate = localDateInTimeZone(task.completedAt, timeZone);
    if (completedDate && completedDate <= today) {
      plannedTasksCompleted += 1;
      dailyPoint.plannedCompleted += 1;
    }
  }
  for (const dailyPoint of daily.values()) {
    dailyPoint.completionRate = dailyPoint.planned === 0
      ? 0
      : Number(((dailyPoint.plannedCompleted / dailyPoint.planned) * 100).toFixed(1));
  }
  const streak = calculateProductiveStreak(allCompletionDates, today);

  return {
    range: { startDate: effectiveStart ?? null, endDate, timeZone },
    completedTasks: rangedCompletions.length,
    productiveDays: Object.keys(completionDates).length,
    currentStreak: streak.current,
    bestStreak: streak.best,
    graceDaysUsed: streak.graceDaysUsed,
    tasksPlanned: planned.length,
    plannedTasksCompleted,
    completionRate: planned.length === 0
      ? 0
      : Number(((plannedTasksCompleted / planned.length) * 100).toFixed(1)),
    overdueCompletions,
    categoryCounts,
    weekdayDistribution,
    completionDates: Object.fromEntries(
      Object.entries(completionDates).sort(([left], [right]) => left.localeCompare(right)),
    ),
    daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export function getProgressData(options: ProgressOptions = {}) {
  const taskHistory = db.select({
    id: tasks.id,
    category: tasks.category,
    date: tasks.date,
    anytimeWeekStart: tasks.anytimeWeekStart,
    recurrenceId: tasks.recurrenceId,
    status: tasks.status,
    completedAt: tasks.completedAt,
  }).from(tasks).orderBy(asc(tasks.id)).all();

  return calculateProgress(taskHistory, options);
}
