import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import { contentMilestones, tasks } from "@/src/db/schema";
import type { TaskCategory, TodayTask } from "@/src/lib/today";

export type FocusArea = Extract<TaskCategory, "career" | "content">;
export type FocusMilestone = typeof contentMilestones.$inferSelect;

export type FocusAreaData = {
  category: FocusArea;
  active: TodayTask[];
  completed: TodayTask[];
  milestones: { active: FocusMilestone[]; achieved: FocusMilestone[] };
};

export function getFocusAreaData(category: FocusArea): FocusAreaData {
  const active = db.select().from(tasks)
    .where(and(eq(tasks.category, category), notInArray(tasks.status, ["completed", "skipped"])))
    .orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id)).all();
  const completed = db.select().from(tasks)
    .where(and(eq(tasks.category, category), eq(tasks.status, "completed")))
    .orderBy(desc(tasks.completedAt), desc(tasks.id)).all();
  const allMilestones = db.select().from(contentMilestones)
    .where(eq(contentMilestones.category, category))
    .orderBy(asc(contentMilestones.createdAt), asc(contentMilestones.id)).all();
  return {
    category, active, completed,
    milestones: {
      active: allMilestones.filter((milestone) => !milestone.achievedAt),
      achieved: allMilestones.filter((milestone) => milestone.achievedAt)
        .sort((a, b) => b.achievedAt!.localeCompare(a.achievedAt!)),
    },
  };
}

type MilestoneValues = { label: string; type: FocusMilestone["type"]; targetValue?: number };

export function createFocusMilestone(category: FocusArea, values: MilestoneValues) {
  const now = new Date().toISOString();
  return db.insert(contentMilestones).values({ category, ...values, targetValue: values.targetValue ?? null, createdAt: now, updatedAt: now }).returning().get();
}

export function updateFocusMilestone(id: number, category: FocusArea, values: MilestoneValues) {
  return db.update(contentMilestones).set({ ...values, targetValue: values.targetValue ?? null, updatedAt: new Date().toISOString() }).where(and(eq(contentMilestones.id, id), eq(contentMilestones.category, category))).run().changes > 0;
}

export function setFocusMilestoneAchieved(id: number, category: FocusArea, achieved: boolean) {
  const now = new Date().toISOString();
  return db.update(contentMilestones).set({ achievedAt: achieved ? now : null, updatedAt: now }).where(and(eq(contentMilestones.id, id), eq(contentMilestones.category, category))).run().changes > 0;
}

export function deleteFocusMilestone(id: number, category: FocusArea) {
  return db.delete(contentMilestones).where(and(eq(contentMilestones.id, id), eq(contentMilestones.category, category))).run().changes > 0;
}
