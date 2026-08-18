import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/client";
import { contentMilestones, tasks } from "../src/db/schema";
import { createFocusMilestone, deleteFocusMilestone, getFocusAreaData, setFocusMilestoneAchieved, updateFocusMilestone } from "../src/lib/focus-areas";

function main() {
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  db.delete(contentMilestones).run(); db.delete(tasks).run();
  db.insert(tasks).values([
    { title: "Career active", category: "career", date: "2026-08-18", status: "in_progress" },
    { title: "Career completed", category: "career", date: "2026-08-17", status: "completed", completedAt: "2026-08-18T09:00:00.000Z" },
    { title: "Career skipped", category: "career", date: "2026-08-16", status: "skipped" },
    { title: "Content active", category: "content", date: "2026-08-18" },
    { title: "Content completed", category: "content", date: "2026-08-15", status: "completed", completedAt: "2026-08-17T09:00:00.000Z" },
  ]).run();
  const career = getFocusAreaData("career");
  assert.deepEqual(career.active.map((task) => task.title), ["Career active"]);
  assert.deepEqual(career.completed.map((task) => task.title), ["Career completed"]);
  assert.deepEqual(career.milestones, { active: [], achieved: [] });
  const content = getFocusAreaData("content");
  assert.deepEqual(content.active.map((task) => task.title), ["Content active"]);
  assert.deepEqual(content.completed.map((task) => task.title), ["Content completed"]);
  const milestone = createFocusMilestone("content", { label: "First 1K views", type: "views", targetValue: 1000 });
  const careerMilestone = createFocusMilestone("career", { label: "First interview", type: "interviews", targetValue: 1 });
  assert.equal(getFocusAreaData("career").milestones.active[0]!.id, careerMilestone.id);
  assert.equal(getFocusAreaData("content").milestones.active[0]!.id, milestone.id);
  assert.equal(updateFocusMilestone(milestone.id, "content", { label: "First 10K views", type: "views", targetValue: 10000 }), true);
  assert.equal(updateFocusMilestone(milestone.id, "career", { label: "Wrong area", type: "custom" }), false);
  assert.equal(setFocusMilestoneAchieved(milestone.id, "content", true), true);
  assert.ok(getFocusAreaData("content").milestones!.achieved[0]!.achievedAt);
  assert.equal(setFocusMilestoneAchieved(milestone.id, "content", false), true);
  assert.equal(getFocusAreaData("content").milestones!.active[0]!.achievedAt, null);
  assert.equal(deleteFocusMilestone(milestone.id, "content"), true);
  assert.equal(deleteFocusMilestone(careerMilestone.id, "career"), true);
  assert.equal(db.select().from(contentMilestones).all().length, 0);
  console.log("Career/Content filtering and shared milestone CRUD persistence passed.");
}
main();
