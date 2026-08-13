import { count } from "drizzle-orm";
import { db } from "@/src/db/client";
import { appSettings, goals, sprints, tasks } from "@/src/db/schema";

export function getFoundationSummary() {
  try {
    const settings = db.select().from(appSettings).limit(1).get();
    const goalCount = db.select({ count: count() }).from(goals).get()?.count ?? 0;
    const sprintCount = db.select({ count: count() }).from(sprints).get()?.count ?? 0;
    const taskCount = db.select({ count: count() }).from(tasks).get()?.count ?? 0;

    return {
      databaseReady: true,
      name: settings?.name ?? "My Planner",
      counts: { goals: goalCount, sprints: sprintCount, tasks: taskCount },
    };
  } catch {
    return {
      databaseReady: false,
      name: "My Planner",
      counts: { goals: 0, sprints: 0, tasks: 0 },
    };
  }
}
