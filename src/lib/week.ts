import { and, asc, eq, gte, isNull, lte, notInArray, or } from "drizzle-orm";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";
import { db } from "@/src/db/client";
import { taskRecurrences, tasks } from "@/src/db/schema";
import { ensureRecurringInstances } from "@/src/lib/recurrence";
import type { PlannerId, TodayTask } from "@/src/lib/today";

export type WeekData = {
  weekStart: string;
  weekEnd: string;
  days: { date: string; tasks: WeekTask[] }[];
  anytime: WeekTask[];
  recurringAnytime: WeeklyRecurrence[];
  overdue: WeekTask[];
  completed: WeekTask[];
};

export type WeekTask = TodayTask & { recurrenceCount: number | null };
export type WeeklyRecurrence = {
  recurrenceId: PlannerId;
  countPerWeek: number;
  tasks: WeekTask[];
  missedLastWeek: number;
};

export function currentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function normalizeWeekStart(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
    isValid(parseISO(candidate))
  ) {
    return format(
      startOfWeek(parseISO(candidate), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
  }
  return currentWeekStart();
}

export function weekHref(start: string, offset: number) {
  return format(addWeeks(parseISO(start), offset), "yyyy-MM-dd");
}

export function getWeekData(weekStart: string): WeekData {
  ensureRecurringInstances(weekStart);
  const weekEnd = format(
    endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const incomplete = notInArray(tasks.status, ["completed", "skipped"]);
  const recurrenceCounts = new Map(
    db
      .select({ id: taskRecurrences.id, count: taskRecurrences.countPerWeek })
      .from(taskRecurrences)
      .all()
      .map((recurrence) => [recurrence.id, recurrence.count]),
  );
  const addRecurrenceCount = (task: TodayTask): WeekTask => ({
    ...task,
    recurrenceCount: task.recurrenceId
      ? (recurrenceCounts.get(Number(task.recurrenceId)) ?? null)
      : null,
  });
  const active = db
    .select()
    .from(tasks)
    .where(
      and(
        or(
          lte(tasks.anytimeWeekStart, weekStart),
          and(isNull(tasks.anytimeWeekStart), lte(tasks.date, weekEnd)),
        ),
        incomplete,
        or(
          isNull(tasks.recurrenceId),
          eq(tasks.recurrenceWeekStart, weekStart),
        ),
      ),
    )
    .orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id))
    .all()
    .map(addRecurrenceCount);
  const completed = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "completed"),
        or(
          and(gte(tasks.date, weekStart), lte(tasks.date, weekEnd)),
          eq(tasks.anytimeWeekStart, weekStart),
        ),
      ),
    )
    .orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id))
    .all()
    .map(addRecurrenceCount);
  const anytimeInstances = [...active, ...completed]
    .filter(
      (task) =>
        task.anytimeWeekStart === weekStart &&
        (!task.recurrenceId ||
          !task.recurrenceCount ||
          (task.recurrenceIndex ?? 0) < task.recurrenceCount),
    )
    .sort((a, b) =>
      a.position - b.position || String(a.id).localeCompare(String(b.id)),
    );
  const recurringById = new Map<PlannerId, WeeklyRecurrence>();
  const previousWeekStart = format(
    addWeeks(parseISO(weekStart), -1),
    "yyyy-MM-dd",
  );
  const missedLastWeek = new Map<PlannerId, number>();
  db.select({ recurrenceId: tasks.recurrenceId })
    .from(tasks)
    .where(
      and(
        eq(tasks.recurrenceWeekStart, previousWeekStart),
        eq(tasks.status, "skipped"),
      ),
    )
    .all()
    .forEach((task) => {
      if (task.recurrenceId)
        missedLastWeek.set(
          task.recurrenceId,
          (missedLastWeek.get(task.recurrenceId) ?? 0) + 1,
        );
    });
  const anytime = anytimeInstances.filter((task) => {
    if (!task.recurrenceId || !task.recurrenceCount) return true;
    const recurrence = recurringById.get(task.recurrenceId) ?? {
      recurrenceId: task.recurrenceId,
      countPerWeek: task.recurrenceCount,
      tasks: [],
      missedLastWeek: missedLastWeek.get(task.recurrenceId) ?? 0,
    };
    recurrence.tasks.push(task);
    recurringById.set(task.recurrenceId, recurrence);
    return false;
  });
  const recurringAnytime = [...recurringById.values()].sort(
    (a, b) =>
      a.tasks[0]!.position - b.tasks[0]!.position ||
      String(a.recurrenceId).localeCompare(String(b.recurrenceId)),
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = format(addDays(parseISO(weekStart), index), "yyyy-MM-dd");
    return {
      date,
      tasks: [
        ...active.filter(
          (task) => !task.anytimeWeekStart && task.date === date,
        ),
        ...completed.filter(
          (task) => !task.anytimeWeekStart && task.date === date,
        ),
      ],
    };
  });
  return {
    weekStart,
    weekEnd,
    days,
    anytime,
    recurringAnytime,
    overdue: active.filter((task) =>
      task.anytimeWeekStart
        ? task.anytimeWeekStart < weekStart
        : task.date < weekStart,
    ),
    completed,
  };
}
