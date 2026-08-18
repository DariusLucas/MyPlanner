import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { tasks } from "@/src/db/schema";

export function toggleTaskPersistence(id: number) {
  const existing = db.select().from(tasks).where(eq(tasks.id, id)).limit(1).get();
  if (!existing) return false;
  const completed = existing.status !== "completed";
  const now = new Date().toISOString();
  db.update(tasks).set({
    status: completed ? "completed" : "not_started",
    completedAt: completed ? now : null,
    updatedAt: now,
  }).where(eq(tasks.id, id)).run();
  return true;
}
