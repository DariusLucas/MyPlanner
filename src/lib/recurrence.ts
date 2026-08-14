import { and, asc, eq, gte, lte, lt, notInArray, sql } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db/client";
import { taskRecurrences, tasks } from "@/src/db/schema";

export function localWeekStart(date = new Date()) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/**
 * Materialize each active recurrence once for the requested week. Older open
 * occurrences are skipped when their new current week starts so they do not
 * roll forward forever, while completed history remains untouched.
 */
export function ensureRecurringInstances(
  weekStart: string,
  activeWeekStart = localWeekStart(),
) {
  if (weekStart !== activeWeekStart) return 0;

  const recurrences = db
    .select()
    .from(taskRecurrences)
    .where(
      and(
        eq(taskRecurrences.active, true),
        lte(taskRecurrences.startWeek, weekStart),
      ),
    )
    .orderBy(asc(taskRecurrences.id))
    .all();
  const now = new Date().toISOString();
  let created = 0;

  db.transaction((tx) => {
    for (const recurrence of recurrences) {
      tx.update(tasks)
        .set({ status: "skipped", updatedAt: now })
        .where(
          and(
            eq(tasks.recurrenceId, recurrence.id),
            lt(tasks.recurrenceWeekStart, weekStart),
            notInArray(tasks.status, ["completed", "skipped"]),
          ),
        )
        .run();

      tx.update(tasks)
        .set({ status: "not_started", updatedAt: now })
        .where(
          and(
            eq(tasks.recurrenceId, recurrence.id),
            eq(tasks.recurrenceWeekStart, weekStart),
            lt(tasks.recurrenceIndex, recurrence.countPerWeek),
            eq(tasks.status, "skipped"),
          ),
        )
        .run();

      tx.update(tasks)
        .set({ status: "skipped", updatedAt: now })
        .where(
          and(
            eq(tasks.recurrenceId, recurrence.id),
            eq(tasks.recurrenceWeekStart, weekStart),
            gte(tasks.recurrenceIndex, recurrence.countPerWeek),
            notInArray(tasks.status, ["completed", "skipped"]),
          ),
        )
        .run();

      const existing = tx
        .select({ recurrenceIndex: tasks.recurrenceIndex })
        .from(tasks)
        .where(
          and(
            eq(tasks.recurrenceId, recurrence.id),
            eq(tasks.recurrenceWeekStart, weekStart),
          ),
        )
        .all();
      const existingIndexes = new Set(
        existing.map((task) => task.recurrenceIndex),
      );
      const nextPosition =
        tx
          .select({
            value: sql<number>`coalesce(max(${tasks.position}), -1) + 1`,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.date, weekStart),
              eq(tasks.anytimeWeekStart, weekStart),
            ),
          )
          .get()?.value ?? 0;

      for (
        let recurrenceIndex = 0;
        recurrenceIndex < recurrence.countPerWeek;
        recurrenceIndex += 1
      ) {
        if (existingIndexes.has(recurrenceIndex)) continue;
        tx.insert(tasks)
          .values({
            title: recurrence.title,
            description: recurrence.description,
            category: recurrence.category,
            priority: recurrence.priority,
            estimatedMinutes: recurrence.estimatedMinutes,
            date: weekStart,
            anytimeWeekStart: weekStart,
            recurrenceId: recurrence.id,
            recurrenceWeekStart: weekStart,
            recurrenceIndex,
            position: nextPosition + recurrenceIndex,
          })
          .run();
        created += 1;
      }
    }
  });

  return created;
}
