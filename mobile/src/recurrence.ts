import { format, startOfWeek } from "date-fns";
import { query, run, transaction } from "./database";

type RecurrenceRow = {
  id: number;
  title: string;
  description: string | null;
  category: "career" | "content" | "other";
  priority: "high" | "normal" | "low";
  estimated_minutes: number | null;
  count_per_week: number;
  start_week: string;
};

export function localWeekStart(date = new Date()) {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export async function ensureRecurringInstances(weekStart: string, activeWeekStart = localWeekStart()) {
  if (weekStart !== activeWeekStart) return 0;
  const recurrences = await query<RecurrenceRow>(
    "SELECT * FROM task_recurrences WHERE active = 1 AND start_week <= ? ORDER BY id",
    [weekStart],
  );
  const now = new Date().toISOString();
  let created = 0;
  await transaction(async () => {
    for (const recurrence of recurrences) {
      await run(
        `UPDATE tasks SET status = 'skipped', updated_at = ?
         WHERE recurrence_id = ? AND recurrence_week_start < ?
         AND status NOT IN ('completed', 'skipped')`,
        [now, recurrence.id, weekStart],
      );
      await run(
        `UPDATE tasks SET status = 'not_started', updated_at = ?
         WHERE recurrence_id = ? AND recurrence_week_start = ?
         AND recurrence_index < ? AND status = 'skipped'`,
        [now, recurrence.id, weekStart, recurrence.count_per_week],
      );
      await run(
        `UPDATE tasks SET status = 'skipped', updated_at = ?
         WHERE recurrence_id = ? AND recurrence_week_start = ?
         AND recurrence_index >= ? AND status NOT IN ('completed', 'skipped')`,
        [now, recurrence.id, weekStart, recurrence.count_per_week],
      );
      const existing = await query<{ recurrence_index: number | null }>(
        "SELECT recurrence_index FROM tasks WHERE recurrence_id = ? AND recurrence_week_start = ?",
        [recurrence.id, weekStart],
      );
      const indexes = new Set(existing.map((task) => task.recurrence_index));
      const [position] = await query<{ value: number }>(
        "SELECT coalesce(max(position), -1) + 1 AS value FROM tasks WHERE date = ? AND anytime_week_start = ?",
        [weekStart, weekStart],
      );
      const firstPosition = position?.value ?? 0;
      for (let index = 0; index < recurrence.count_per_week; index += 1) {
        if (indexes.has(index)) continue;
        await run(
          `INSERT INTO tasks (
            title, description, category, date, anytime_week_start, recurrence_id,
            recurrence_week_start, recurrence_index, priority, position,
            estimated_minutes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recurrence.title, recurrence.description, recurrence.category, weekStart, weekStart,
            recurrence.id, weekStart, index, recurrence.priority, firstPosition + index,
            recurrence.estimated_minutes, now, now],
        );
        created += 1;
      }
    }
  });
  return created;
}
