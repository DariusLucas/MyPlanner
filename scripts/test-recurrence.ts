import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const databasePath = path.join(
  os.tmpdir(),
  `my-planner-recurrence-${process.pid}.db`,
);
process.env.DATABASE_URL = databasePath;

async function main() {
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { db } = await import("../src/db/client");
  const { taskRecurrences, tasks } = await import("../src/db/schema");
  const { ensureRecurringInstances } = await import("../src/lib/recurrence");
  const { getWeekData } = await import("../src/lib/week");
  const { and, eq, notInArray } = await import("drizzle-orm");

  migrate(db, { migrationsFolder: "./src/db/migrations" });
  const recurrence = db
    .insert(taskRecurrences)
    .values({
      title: "Practice presentation",
      category: "career",
      priority: "normal",
      countPerWeek: 3,
      startWeek: "2026-08-10",
    })
    .returning({ id: taskRecurrences.id })
    .get();

  assert.equal(
    ensureRecurringInstances("2026-08-10", "2026-08-10"),
    3,
    "first week creates the requested count",
  );
  assert.equal(
    ensureRecurringInstances("2026-08-10", "2026-08-10"),
    0,
    "reloading a week does not duplicate instances",
  );

  const firstWeek = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.recurrenceId, recurrence.id),
        eq(tasks.recurrenceWeekStart, "2026-08-10"),
      ),
    )
    .all();
  assert.equal(firstWeek.length, 3);
  db.update(tasks)
    .set({ status: "completed", completedAt: "2026-08-12T10:00:00.000Z" })
    .where(eq(tasks.id, firstWeek[0]!.id))
    .run();

  assert.equal(
    ensureRecurringInstances("2026-08-17", "2026-08-10"),
    0,
    "browsing a future week does not create instances",
  );
  assert.equal(
    ensureRecurringInstances("2026-08-17", "2026-08-17"),
    3,
    "new week creates exactly the requested count",
  );
  const nextWeek = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.recurrenceId, recurrence.id),
        eq(tasks.recurrenceWeekStart, "2026-08-17"),
      ),
    )
    .all();
  assert.equal(nextWeek.length, 3);
  assert.equal(
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.recurrenceId, recurrence.id),
          eq(tasks.status, "completed"),
        ),
      )
      .all().length,
    1,
    "completed history is preserved",
  );
  assert.equal(
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.recurrenceId, recurrence.id),
          eq(tasks.recurrenceWeekStart, "2026-08-10"),
          notInArray(tasks.status, ["completed", "skipped"]),
        ),
      )
      .all().length,
    0,
    "old incomplete occurrences are not rolled forward",
  );
  assert.equal(
    ensureRecurringInstances("2026-08-17", "2026-08-17"),
    0,
    "reloading the new week does not duplicate instances",
  );
  const groupedWeek = getWeekData("2026-08-17");
  assert.equal(
    groupedWeek.recurringAnytime.length,
    1,
    "a recurrence is presented as one weekly routine",
  );
  assert.equal(
    groupedWeek.recurringAnytime[0]?.tasks.length,
    3,
    "the weekly routine keeps all of its check-ins",
  );
  assert.equal(
    groupedWeek.recurringAnytime[0]?.missedLastWeek,
    2,
    "missed routine check-ins are summarized without carrying them forward",
  );
  const futureWeek = getWeekData("2026-08-24");
  assert.equal(
    futureWeek.recurringAnytime.length,
    0,
    "future weeks do not show a routine before that week starts",
  );
  assert.equal(
    futureWeek.overdue.some((task) => task.recurrenceId === recurrence.id),
    false,
    "future weeks do not show routine check-ins as overdue",
  );
  db.update(taskRecurrences)
    .set({ countPerWeek: 2 })
    .where(eq(taskRecurrences.id, recurrence.id))
    .run();
  assert.equal(
    ensureRecurringInstances("2026-08-17", "2026-08-17"),
    0,
    "editing a recurrence does not duplicate the week",
  );
  assert.equal(
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.recurrenceId, recurrence.id),
          eq(tasks.recurrenceWeekStart, "2026-08-17"),
          notInArray(tasks.status, ["completed", "skipped"]),
        ),
      )
      .all().length,
    2,
    "editing the count hides extra open instances",
  );
  assert.equal(
    getWeekData("2026-08-17").recurringAnytime[0]?.tasks.length,
    2,
    "the weekly routine renders only the saved target after it is reduced",
  );

  const flexibleTask = db
    .insert(tasks)
    .values({
      title: "Flexible follow-up",
      category: "career",
      priority: "normal",
      date: "2026-08-10",
      anytimeWeekStart: "2026-08-10",
      position: 20,
    })
    .returning({ id: tasks.id })
    .get();
  const scheduledTask = db
    .insert(tasks)
    .values({
      title: "Scheduled follow-up",
      category: "career",
      priority: "normal",
      date: "2026-08-12",
      position: 21,
    })
    .returning({ id: tasks.id })
    .get();
  const followingWeek = getWeekData("2026-08-17");
  assert.equal(
    followingWeek.overdue.some((task) => task.id === flexibleTask.id),
    true,
    "unfinished Anytime tasks carry into the next week as overdue",
  );
  assert.equal(
    followingWeek.overdue.some((task) => task.id === scheduledTask.id),
    true,
    "unfinished scheduled tasks carry into the next week as overdue",
  );

  const runtimeDb = (
    globalThis as unknown as { sqlite?: { close: () => void } }
  ).sqlite;
  runtimeDb?.close();
  for (const suffix of ["", "-wal", "-shm"])
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  console.log("Recurrence checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
