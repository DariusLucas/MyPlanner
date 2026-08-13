import { count } from "drizzle-orm";
import { db } from "./client";
import { appSettings } from "./schema";

export function seedFoundation() {
  const existingSettings = db.select({ count: count() }).from(appSettings).get();

  if ((existingSettings?.count ?? 0) > 0) {
    return { inserted: false };
  }

  db.insert(appSettings)
    .values({
      id: 1,
      name: "My Planner",
      theme: "system",
      weekStartsOn: 1,
      defaultCareerTargetDays: 5,
      defaultWeeklyApplications: 10,
      defaultWeeklyContent: 3,
    })
    .run();

  return { inserted: true };
}
