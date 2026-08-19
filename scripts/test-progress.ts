import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProgressTask } from "../src/lib/progress";

const databasePath = path.join(os.tmpdir(), `my-planner-progress-${process.pid}.db`);
process.env.DATABASE_URL = databasePath;

const baseTask: ProgressTask = {
  category: "career",
  date: "2026-08-19",
  anytimeWeekStart: null,
  status: "not_started",
  completedAt: null,
};

function task(values: Partial<ProgressTask>): ProgressTask {
  return { ...baseTask, ...values };
}

async function main() {
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
const { db } = await import("../src/db/client");
const { tasks } = await import("../src/db/schema");
const {
  calculateProgress,
  calculateProductiveStreak,
  getProgressData,
  localDateInTimeZone,
} = await import("../src/lib/progress");
const {
  buildHeatmap,
  buildProgressPeriods,
  normalizeProgressCategory,
  normalizeProgressRange,
  progressRangeStart,
} = await import("../src/lib/progress-visuals");
migrate(db, { migrationsFolder: "./src/db/migrations" });

const options = {
  today: "2026-08-19",
  timeZone: "Europe/Bucharest",
} as const;

const empty = calculateProgress([], options);
assert.deepEqual(empty, {
  range: { startDate: null, endDate: "2026-08-19", timeZone: "Europe/Bucharest" },
  completedTasks: 0,
  productiveDays: 0,
  currentStreak: 0,
  bestStreak: 0,
  graceDaysUsed: 0,
  tasksPlanned: 0,
  plannedTasksCompleted: 0,
  completionRate: 0,
  overdueCompletions: 0,
  categoryCounts: { career: 0, content: 0, personal: 0 },
  weekdayDistribution: {
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  },
  completionDates: {},
  daily: [],
});

assert.equal(
  localDateInTimeZone("2026-08-18T21:30:00.000Z", "Europe/Bucharest"),
  "2026-08-19",
  "UTC timestamps normalize to the configured local date",
);
assert.equal(
  localDateInTimeZone("2026-10-24T21:30:00.000Z", "Europe/Bucharest"),
  "2026-10-25",
  "normalization remains correct at the DST fallback boundary",
);

const history = [
  task({
    category: "career",
    date: "2026-08-18",
    status: "completed",
    completedAt: "2026-08-18T21:30:00.000Z",
  }),
  task({
    category: "content",
    date: "2026-08-17",
    status: "completed",
    completedAt: "2026-08-18T12:00:00.000Z",
  }),
  task({
    category: "other",
    date: "2026-08-19",
    status: "completed",
    completedAt: "2026-08-19T08:00:00.000Z",
  }),
  task({
    category: "other",
    date: "2026-08-18",
    status: "skipped",
  }),
  task({
    date: "2026-08-17",
    status: "not_started",
    // A reopened task must not survive as progress even if legacy data retained a timestamp.
    completedAt: "2026-08-17T08:00:00.000Z",
  }),
  task({
    date: "2026-08-20",
    status: "not_started",
  }),
];

const progress = calculateProgress(history, options);
assert.equal(progress.completedTasks, 3);
assert.equal(progress.productiveDays, 2);
assert.equal(progress.tasksPlanned, 5, "future plans are excluded from the denominator");
assert.equal(progress.plannedTasksCompleted, 3);
assert.equal(progress.completionRate, 60);
assert.equal(progress.overdueCompletions, 2);
assert.deepEqual(progress.categoryCounts, { career: 1, content: 1, personal: 1 });
assert.deepEqual(progress.completionDates, { "2026-08-18": 1, "2026-08-19": 2 });
assert.equal(progress.weekdayDistribution.tuesday, 1);
assert.equal(progress.weekdayDistribution.wednesday, 2);
assert.deepEqual(progress.daily, [
  {
    date: "2026-08-17",
    completed: 0,
    productive: false,
    planned: 2,
    plannedCompleted: 1,
    completionRate: 50,
    categoryCounts: { career: 0, content: 0, personal: 0 },
  },
  {
    date: "2026-08-18",
    completed: 1,
    productive: true,
    planned: 2,
    plannedCompleted: 1,
    completionRate: 50,
    categoryCounts: { career: 0, content: 1, personal: 0 },
  },
  {
    date: "2026-08-19",
    completed: 2,
    productive: true,
    planned: 1,
    plannedCompleted: 1,
    completionRate: 100,
    categoryCounts: { career: 1, content: 0, personal: 1 },
  },
]);

const contentOnly = calculateProgress(history, { ...options, category: "content" });
assert.equal(contentOnly.completedTasks, 1);
assert.equal(contentOnly.tasksPlanned, 1);
assert.deepEqual(contentOnly.categoryCounts, { career: 0, content: 1, personal: 0 });

const recurring = calculateProgress([
  task({
    id: 1,
    date: "2026-08-10",
    anytimeWeekStart: "2026-08-10",
    recurrenceId: 7,
    status: "completed",
    completedAt: "2026-08-15T09:00:00.000Z",
  }),
  task({
    id: 2,
    date: "2026-08-10",
    anytimeWeekStart: "2026-08-10",
    recurrenceId: 7,
    status: "completed",
    completedAt: "2026-08-17T09:00:00.000Z",
  }),
  task({
    id: 3,
    date: "2026-08-10",
    anytimeWeekStart: "2026-08-10",
    recurrenceId: 7,
    status: "skipped",
  }),
], options);
assert.equal(recurring.tasksPlanned, 3, "each persisted recurrence instance is planned once");
assert.equal(recurring.completedTasks, 2, "completed recurrence instances are not deduplicated");
assert.equal(recurring.overdueCompletions, 1, "Anytime work is overdue only after its week ends");
assert.equal(recurring.completionRate, 66.7);

const range = calculateProgress(history, {
  ...options,
  startDate: "2026-08-19",
  endDate: "2026-08-31",
});
assert.equal(range.range.endDate, "2026-08-19", "future range ends are capped at today");
assert.equal(range.completedTasks, 2);
assert.equal(range.tasksPlanned, 1);

const longHistory: ProgressTask[] = [];
for (let month = 1; month <= 6; month += 1) {
  for (const day of [1, 4, 7, 10]) {
    const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    longHistory.push(task({ date, status: "completed", completedAt: `${date}T12:00:00.000Z` }));
  }
}
const longProgress = calculateProgress(longHistory, {
  today: "2026-06-10",
  timeZone: "UTC",
});
assert.equal(longProgress.completedTasks, 24);
assert.equal(longProgress.productiveDays, 24);
assert.equal(longProgress.bestStreak, 4, "multi-month gaps end each grace-based streak");
assert.equal(longProgress.currentStreak, 4);
const monthlyPeriods = buildProgressPeriods(longProgress, "month");
assert.equal(monthlyPeriods.length, 6, "long histories produce stable calendar periods");
assert.deepEqual(
  monthlyPeriods.map((period) => period.completed),
  [4, 4, 4, 4, 4, 4],
);

const rangedPeriods = buildProgressPeriods(calculateProgress(history, {
  ...options,
  startDate: "2026-08-01",
}), "week");
assert.equal(rangedPeriods.length, 4, "inactive weeks remain visible as zero periods");
assert.equal(rangedPeriods[0]?.completed, 0);
assert.equal(rangedPeriods.at(-1)?.completed, 3);

const heatmap = buildHeatmap(longProgress);
assert.ok(heatmap.length <= 54 * 7, "all-time heatmaps stay within a practical one-year window");
assert.equal(heatmap.find((day) => day.date === "2026-06-10")?.completed, 1);

assert.equal(normalizeProgressRange("unexpected"), "3m");
assert.equal(normalizeProgressCategory("unexpected"), "all");
assert.equal(progressRangeStart("3m", "2026-08-19"), "2026-05-20");
assert.equal(progressRangeStart("all", "2026-08-19"), undefined);

assert.deepEqual(
  calculateProductiveStreak(["2026-08-13", "2026-08-16", "2026-08-19"], "2026-08-21"),
  { current: 3, best: 3, graceDaysUsed: 1 },
  "streaks preserve the Dashboard two-grace-day semantics",
);

assert.throws(
  () => calculateProgress([], { ...options, timeZone: "Not/A_Timezone" }),
  RangeError,
  "invalid timezone configuration fails explicitly",
);

db.insert(tasks).values([
  {
    title: "Persisted completion",
    category: "content",
    date: "2026-08-18",
    status: "completed",
    completedAt: "2026-08-18T21:30:00.000Z",
  },
  {
    title: "Persisted skipped recurrence",
    category: "career",
    date: "2026-08-18",
    anytimeWeekStart: "2026-08-18",
    status: "skipped",
  },
]).run();
const persisted = getProgressData(options);
assert.equal(persisted.completedTasks, 1);
assert.equal(persisted.tasksPlanned, 2);
assert.deepEqual(persisted.categoryCounts, { career: 0, content: 1, personal: 0 });

const runtimeDb = (globalThis as unknown as { sqlite?: { close: () => void } }).sqlite;
runtimeDb?.close();
for (const suffix of ["", "-wal", "-shm"])
  fs.rmSync(`${databasePath}${suffix}`, { force: true });

console.log("Progress contract, timezone boundaries, cohorts, recurrence, reopening, and long history passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
