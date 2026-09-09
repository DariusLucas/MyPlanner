import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_URL = path.join(os.tmpdir(), `my-planner-dashboard-${process.pid}.db`);

async function main() {
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
const { eq } = await import("drizzle-orm");
const { db } = await import("../src/db/client");
const { quickThoughts, tasks } = await import("../src/db/schema");
const { calculateStreak, getDashboardData, localDayBounds } = await import("../src/lib/dashboard");
const { buildWeekCompletion } = await import("../src/lib/daily-completion");
const { toggleTaskPersistence } = await import("../src/lib/task-completion");
migrate(db, { migrationsFolder: "./src/db/migrations" });
db.delete(quickThoughts).run();
db.delete(tasks).run();

const now = new Date(2026, 9, 25, 12, 0, 0);
const bounds = localDayBounds("2026-10-25");
assert.equal((new Date(bounds.end).getTime() - new Date(bounds.start).getTime()) / 3_600_000, 25, "DST fallback day must span 25 hours in Europe/Bucharest");

db.insert(tasks).values([
  { title: "Today active", category: "career", date: "2026-10-25", position: 0 },
  { title: "Overdue active", category: "content", date: "2026-10-24", position: 0 },
  { title: "Anytime visible", category: "other", date: "2026-10-19", anytimeWeekStart: "2026-10-19", position: 0 },
  { title: "Completed today", category: "career", date: "2026-10-24", status: "completed", completedAt: "2026-10-25T09:00:00.000Z", position: 1 },
  { title: "Completed yesterday", category: "career", date: "2026-10-24", status: "completed", completedAt: "2026-10-24T09:00:00.000Z", position: 2 },
]).run();

let data = getDashboardData(now);
assert.deepEqual(data.active.map((task) => task.title), ["Today active", "Anytime visible"]);
assert.deepEqual(data.overdue.map((task) => task.title), ["Overdue active"]);
assert.deepEqual(data.completedToday.map((task) => task.title), ["Completed today"]);
assert.deepEqual(data.counts, { completed: 1, remaining: 3, planned: 4 });
assert.equal(data.weekCompletion.length, 7, "dashboard includes Monday-through-Sunday completion data");

const weekCompletion = buildWeekCompletion([
  { date: "2026-10-19", anytimeWeekStart: null, status: "completed" },
  { date: "2026-10-19", anytimeWeekStart: null, status: "not_started" },
  { date: "2026-10-20", anytimeWeekStart: null, status: "completed" },
  { date: "2026-10-21", anytimeWeekStart: null, status: "not_started" },
  { date: "2026-10-19", anytimeWeekStart: "2026-10-19", status: "completed" },
], "2026-10-19");
assert.deepEqual(weekCompletion[0], { date: "2026-10-19", completed: 1, planned: 2, remaining: 1, percentage: 50 });
assert.deepEqual(weekCompletion[1], { date: "2026-10-20", completed: 1, planned: 1, remaining: 0, percentage: 100 });
assert.deepEqual(weekCompletion[2], { date: "2026-10-21", completed: 0, planned: 1, remaining: 1, percentage: 0 });
assert.deepEqual(weekCompletion[6], { date: "2026-10-25", completed: 0, planned: 0, remaining: 0, percentage: 0 });

const activeId = data.active[0]!.id;
assert.equal(toggleTaskPersistence(Number(activeId)), true);
assert.equal(db.select().from(tasks).where(eq(tasks.id, Number(activeId))).get()!.status, "completed");
assert.equal(toggleTaskPersistence(Number(activeId)), true);
assert.equal(db.select().from(tasks).where(eq(tasks.id, Number(activeId))).get()!.status, "not_started");
assert.equal(db.select().from(tasks).where(eq(tasks.id, Number(activeId))).get()!.completedAt, null);

const thought = db.insert(quickThoughts).values({ text: "First thought" }).returning().get();
db.update(quickThoughts).set({ text: "Edited thought" }).where(eq(quickThoughts.id, thought.id)).run();
assert.equal(db.select().from(quickThoughts).where(eq(quickThoughts.id, thought.id)).get()!.text, "Edited thought");
db.delete(quickThoughts).where(eq(quickThoughts.id, thought.id)).run();
assert.equal(db.select().from(quickThoughts).where(eq(quickThoughts.id, thought.id)).get(), undefined);

assert.deepEqual(calculateStreak(["2026-10-20", "2026-10-23"], "2026-10-26"), { current: 2, best: 2, state: "cold", graceDaysUsed: 2 });
assert.equal(calculateStreak(["2026-10-20", "2026-10-23"], "2026-10-27").current, 0);
assert.deepEqual(calculateStreak(["2026-10-20", "2026-10-23", "2026-10-26"], "2026-10-26"), { current: 3, best: 3, state: "hot", graceDaysUsed: 0 });

data = getDashboardData(now);
assert.equal(data.recentThoughts.length, 0);
console.log("Dashboard Today contract, weekly completion, DST bounds, completion undo, streak grace, and thought CRUD passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
