import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { allTasks, query, type MobileTask } from "./database";
import { ensureRecurringInstances } from "./recurrence";

export type MobileThought = { id: number; text: string; createdAt: string; updatedAt: string };
export type MobileMilestone = {
  id: number;
  category: "career" | "content";
  label: string;
  type: "views" | "likes" | "followers" | "applications" | "interviews" | "offers" | "custom";
  targetValue: number | null;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type ProgressCategory = "career" | "content" | "personal";
type WeekdayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

function localDate(value = new Date()) {
  return format(value, "yyyy-MM-dd");
}

function dateNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function calendarDayDifference(later: string, earlier: string) {
  return Math.round((dateNumber(later) - dateNumber(earlier)) / 86_400_000);
}

function calculateStreak(completionDates: string[], today: string) {
  const dates = [...new Set(completionDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))]
    .filter((date) => date <= today)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | undefined;
  for (const date of dates) {
    const gap = previous ? calendarDayDifference(date, previous) : Number.POSITIVE_INFINITY;
    run = !previous || gap > 3 ? 1 : run + 1;
    best = Math.max(best, run);
    previous = date;
  }
  if (!previous) return { current: 0, best: 0, graceDaysUsed: 0 };
  const gap = calendarDayDifference(today, previous);
  if (gap > 3) return { current: 0, best, graceDaysUsed: 0 };
  return { current: run, best, graceDaysUsed: Math.max(0, gap - 1) };
}

function localCompletionDate(instant: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getDashboardData() {
  const now = new Date();
  const date = localDate(now);
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  await ensureRecurringInstances(weekStart, weekStart);
  const tasks = await allTasks();
  const incomplete = (task: MobileTask) => !["completed", "skipped"].includes(task.status);
  const active = tasks.filter((task) => task.date === date && !task.anytimeWeekStart && incomplete(task))
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const overdue = tasks.filter((task) => task.date < date && !task.anytimeWeekStart && incomplete(task))
    .sort((left, right) => left.date.localeCompare(right.date) || left.position - right.position || left.id - right.id);
  const completedToday = tasks.filter((task) => task.status === "completed" && task.completedAt && localCompletionDate(task.completedAt) === date)
    .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "") || right.id - left.id);
  const completionDates = tasks.flatMap((task) => task.status === "completed" && task.completedAt ? [localCompletionDate(task.completedAt)] : []);
  const thoughtRows = await query<{ id: number; text: string; created_at: string; updated_at: string }>(
    "SELECT * FROM quick_thoughts ORDER BY created_at DESC, id DESC",
  );
  const allThoughts = thoughtRows.map((thought) => ({ id: thought.id, text: thought.text, createdAt: thought.created_at, updatedAt: thought.updated_at }));
  const remaining = active.length + overdue.length;
  const streak = calculateStreak(completionDates, date);
  return {
    date,
    active,
    overdue,
    completedToday,
    counts: { completed: completedToday.length, remaining, planned: remaining + completedToday.length },
    streak: {
      ...streak,
      state: streak.graceDaysUsed === 0 ? "hot" as const : streak.graceDaysUsed === 1 ? "cooling" as const : "cold" as const,
    },
    recentThoughts: allThoughts.slice(0, 3),
    allThoughts,
  };
}

export async function getFocusAreaData(category: "career" | "content") {
  const tasks = await allTasks("category = ?", [category]);
  const active = tasks.filter((task) => !["completed", "skipped"].includes(task.status))
    .sort((left, right) => left.date.localeCompare(right.date) || left.position - right.position || left.id - right.id);
  const completed = tasks.filter((task) => task.status === "completed")
    .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "") || right.id - left.id);
  const rows = await query<{
    id: number; category: "career" | "content"; label: string; type: MobileMilestone["type"];
    target_value: number | null; achieved_at: string | null; created_at: string; updated_at: string;
  }>("SELECT * FROM content_milestones WHERE category = ? ORDER BY created_at, id", [category]);
  const milestones = rows.map((row) => ({
    id: row.id, category: row.category, label: row.label, type: row.type, targetValue: row.target_value,
    achievedAt: row.achieved_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
  return {
    category,
    active,
    completed,
    milestones: {
      active: milestones.filter((milestone) => !milestone.achievedAt),
      achieved: milestones.filter((milestone) => milestone.achievedAt)
        .sort((left, right) => right.achievedAt!.localeCompare(left.achievedAt!)),
    },
  };
}

export async function getWeekData(weekStart: string) {
  await ensureRecurringInstances(weekStart);
  const weekEnd = format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const tasks = await allTasks();
  const recurrenceRows = await query<{ id: number; count_per_week: number }>("SELECT id, count_per_week FROM task_recurrences");
  const recurrenceCounts = new Map(recurrenceRows.map((row) => [row.id, row.count_per_week]));
  const withCount = (task: MobileTask) => ({ ...task, recurrenceCount: task.recurrenceId ? recurrenceCounts.get(task.recurrenceId) ?? null : null });
  const active = tasks.filter((task) => {
    const isActive = !["completed", "skipped"].includes(task.status);
    const due = task.anytimeWeekStart ? task.anytimeWeekStart <= weekStart : task.date <= weekEnd;
    const recurrenceMatches = !task.recurrenceId || task.recurrenceWeekStart === weekStart;
    return isActive && due && recurrenceMatches;
  }).map(withCount);
  const completed = tasks.filter((task) => task.status === "completed" && (
    (task.date >= weekStart && task.date <= weekEnd) || task.anytimeWeekStart === weekStart
  )).map(withCount);
  const anytimeInstances = [...active, ...completed]
    .filter((task) => task.anytimeWeekStart === weekStart && (!task.recurrenceId || !task.recurrenceCount || (task.recurrenceIndex ?? 0) < task.recurrenceCount))
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const previousWeek = format(addWeeks(parseISO(weekStart), -1), "yyyy-MM-dd");
  const missedRows = await query<{ recurrence_id: number; count: number }>(
    "SELECT recurrence_id, count(*) AS count FROM tasks WHERE recurrence_week_start = ? AND status = 'skipped' AND recurrence_id IS NOT NULL GROUP BY recurrence_id",
    [previousWeek],
  );
  const missed = new Map(missedRows.map((row) => [row.recurrence_id, row.count]));
  const recurring = new Map<number, { recurrenceId: number; countPerWeek: number; tasks: ReturnType<typeof withCount>[]; missedLastWeek: number }>();
  const anytime = anytimeInstances.filter((task) => {
    if (!task.recurrenceId || !task.recurrenceCount) return true;
    const group = recurring.get(task.recurrenceId) ?? {
      recurrenceId: task.recurrenceId,
      countPerWeek: task.recurrenceCount,
      tasks: [],
      missedLastWeek: missed.get(task.recurrenceId) ?? 0,
    };
    group.tasks.push(task);
    recurring.set(task.recurrenceId, group);
    return false;
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    return { date, tasks: [...active, ...completed].filter((task) => !task.anytimeWeekStart && task.date === date) };
  });
  return {
    weekStart,
    weekEnd,
    days,
    anytime,
    recurringAnytime: [...recurring.values()].sort((left, right) => left.tasks[0]!.position - right.tasks[0]!.position || left.recurrenceId - right.recurrenceId),
    overdue: active.filter((task) => task.anytimeWeekStart ? task.anytimeWeekStart < weekStart : task.date < weekStart),
    completed,
  };
}

const weekdayKeys: WeekdayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function progressCategory(category: MobileTask["category"]): ProgressCategory { return category === "other" ? "personal" : category; }
function emptyCategories(): Record<ProgressCategory, number> { return { career: 0, content: 0, personal: 0 }; }
function emptyWeekdays(): Record<WeekdayKey, number> { return { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 }; }
function weekday(date: string) { return weekdayKeys[(new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7]!; }

export async function getProgressData(startDate: string | undefined, category: ProgressCategory | undefined) {
  const tasks = await allTasks();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = localDate();
  const selected = category ? tasks.filter((task) => progressCategory(task.category) === category) : tasks;
  const categoryCounts = emptyCategories();
  const weekdayDistribution = emptyWeekdays();
  const completionDates: Record<string, number> = {};
  const daily = new Map<string, {
    date: string; completed: number; productive: boolean; planned: number; plannedCompleted: number;
    completionRate: number; categoryCounts: Record<ProgressCategory, number>;
  }>();
  const allCompletionDates: string[] = [];
  let overdueCompletions = 0;
  const day = (date: string) => {
    const existing = daily.get(date);
    if (existing) return existing;
    const point = { date, completed: 0, productive: false, planned: 0, plannedCompleted: 0, completionRate: 0, categoryCounts: emptyCategories() };
    daily.set(date, point);
    return point;
  };
  const completed = selected.flatMap((task) => {
    if (task.status !== "completed" || !task.completedAt) return [];
    const completedDate = localCompletionDate(task.completedAt, timeZone);
    allCompletionDates.push(completedDate);
    return completedDate <= today ? [{ task, completedDate }] : [];
  });
  const ranged = completed.filter(({ completedDate }) => (!startDate || completedDate >= startDate) && completedDate <= today);
  for (const { task, completedDate } of ranged) {
    const taskCategory = progressCategory(task.category);
    categoryCounts[taskCategory] += 1;
    weekdayDistribution[weekday(completedDate)] += 1;
    completionDates[completedDate] = (completionDates[completedDate] ?? 0) + 1;
    const point = day(completedDate);
    point.completed += 1;
    point.productive = true;
    point.categoryCounts[taskCategory] += 1;
    const deadline = task.anytimeWeekStart ? format(addDays(parseISO(task.anytimeWeekStart), 6), "yyyy-MM-dd") : task.date;
    if (completedDate > deadline) overdueCompletions += 1;
  }
  const planned = selected.filter((task) => task.date <= today && (!startDate || task.date >= startDate));
  let plannedTasksCompleted = 0;
  for (const task of planned) {
    const point = day(task.date);
    point.planned += 1;
    if (task.status === "completed" && task.completedAt && localCompletionDate(task.completedAt, timeZone) <= today) {
      point.plannedCompleted += 1;
      plannedTasksCompleted += 1;
    }
  }
  for (const point of daily.values()) {
    point.completionRate = point.planned ? Number(((point.plannedCompleted / point.planned) * 100).toFixed(1)) : 0;
  }
  const streak = calculateStreak(allCompletionDates, today);
  return {
    range: { startDate: startDate ?? null, endDate: today, timeZone },
    completedTasks: ranged.length,
    productiveDays: Object.keys(completionDates).length,
    currentStreak: streak.current,
    bestStreak: streak.best,
    graceDaysUsed: streak.graceDaysUsed,
    tasksPlanned: planned.length,
    plannedTasksCompleted,
    completionRate: planned.length ? Number(((plannedTasksCompleted / planned.length) * 100).toFixed(1)) : 0,
    overdueCompletions,
    categoryCounts,
    weekdayDistribution,
    completionDates: Object.fromEntries(Object.entries(completionDates).sort(([left], [right]) => left.localeCompare(right))),
    daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export function currentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}
