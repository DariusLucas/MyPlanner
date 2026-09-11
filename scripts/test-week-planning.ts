import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addDays, format, parseISO } from "date-fns";

const databasePath = path.join(
  os.tmpdir(),
  `my-planner-week-planning-${process.pid}.db`,
);
process.env.DATABASE_URL = databasePath;

async function main() {
  const weekSource = fs.readFileSync("src/components/week-view.tsx", "utf8");
  assert.match(
    weekSource,
    /useState<"checklist" \| "board">\("checklist"\)/,
    "Checklist remains the default week view",
  );
  assert.equal(
    (weekSource.match(/<InlineTaskComposer/g) ?? []).length,
    1,
    "only the selected day exposes a contextual quick-add composer",
  );
  assert.match(weekSource, /selectedDate === date/, "one day is explicitly selected for quick add");
  assert.match(weekSource, /Nothing planned yet\. Add your first task when you are ready\./, "the empty week has one clear next action");
  assert.match(weekSource, /Make this a weekly routine/, "routine creation is progressively disclosed");
  assert.match(weekSource, /Choose your check-ins for each week\. The target resets every Monday\./, "weekly targets explain check-ins and Monday reset");
  assert.doesNotMatch(weekSource, /Repeat this week|No repeat|\d+x per week/, "ambiguous recurrence language is removed");

  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { db } = await import("../src/db/client");
  const { tasks } = await import("../src/db/schema");
  const {
    currentWeekStart,
    getWeekData,
    normalizeWeekStart,
    weekHref,
  } = await import("../src/lib/week");
  const { persistPlannedTask } = await import(
    "../src/lib/week-planning"
  );
  const { eq } = await import("drizzle-orm");

  migrate(db, { migrationsFolder: "./src/db/migrations" });

  assert.equal(
    normalizeWeekStart("2027-01-03"),
    "2026-12-28",
    "a Sunday query resolves to its Monday week boundary",
  );
  assert.equal(
    weekHref("2026-12-28", 1),
    "2027-01-04",
    "next-week navigation crosses the year boundary",
  );
  assert.equal(
    weekHref("2027-01-04", -1),
    "2026-12-28",
    "previous-week navigation crosses the year boundary",
  );

  const nextWeekStart = weekHref(currentWeekStart(), 1);
  const tuesdayDate = format(
    addDays(parseISO(nextWeekStart), 1),
    "yyyy-MM-dd",
  );

  const career = persistPlannedTask({
    title: "Prepare interview examples",
    category: "career",
    priority: "normal",
    date: tuesdayDate,
  });
  persistPlannedTask({
    title: "Draft weekly video",
    category: "content",
    priority: "normal",
    date: nextWeekStart,
  });
  const flexible = persistPlannedTask({
    title: "Choose a personal reset",
    category: "other",
    priority: "normal",
    date: nextWeekStart,
    anytimeWeekStart: nextWeekStart,
  });

  const plannedWeek = getWeekData(nextWeekStart);
  assert.equal(
    plannedWeek.days[1]?.tasks.some(
      (task) =>
        task.id === career.taskId &&
        task.title === "Prepare interview examples" &&
        task.category === "career",
    ),
    true,
    "a task can be created directly for a day next week",
  );
  assert.equal(
    plannedWeek.days[0]?.tasks.some(
      (task) => task.title === "Draft weekly video" && task.category === "content",
    ),
    true,
    "quick category selection persists on a scheduled task",
  );
  assert.equal(
    plannedWeek.anytime.some(
      (task) =>
        task.id === flexible.taskId &&
        task.anytimeWeekStart === nextWeekStart &&
        task.category === "other",
    ),
    true,
    "an Anytime task is attached to the selected future week and category",
  );

  const historicalWeekStart = "2024-12-30";
  const historical = persistPlannedTask({
    title: "Archived planning evidence",
    category: "content",
    priority: "normal",
    date: "2025-01-02",
  });
  db.update(tasks)
    .set({
      status: "completed",
      completedAt: "2025-01-02T18:30:00.000Z",
    })
    .where(eq(tasks.id, historical.taskId!))
    .run();
  const pastWeek = getWeekData(historicalWeekStart);
  assert.equal(
    pastWeek.days[3]?.tasks.some((task) => task.id === historical.taskId),
    true,
    "completed tasks remain visible when browsing a past week",
  );
  assert.equal(
    pastWeek.completed.some((task) => task.id === historical.taskId),
    true,
    "historical completion data remains intact",
  );

  const runtimeDb = (
    globalThis as unknown as { sqlite?: { close: () => void } }
  ).sqlite;
  runtimeDb?.close();
  for (const suffix of ["", "-wal", "-shm"])
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  console.log("Week planning checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
