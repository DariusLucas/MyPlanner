import { and, asc, desc, eq, notInArray, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { contentMilestones, tasks } from "@/src/db/schema";
import type { PlannerId, TodayTask } from "@/src/lib/today";
import type { PlannerCategory } from "@/src/lib/categories";

export type FocusArea = string;
export type FocusMilestone = Omit<typeof contentMilestones.$inferSelect, "id" | "category" | "categoryId"> & {
  id: PlannerId;
  category: FocusArea;
  categoryId?: string | null;
  revision?: number;
};

export type FocusAreaData = {
  category: PlannerCategory;
  active: TodayTask[];
  completed: TodayTask[];
  milestones: { active: FocusMilestone[]; achieved: FocusMilestone[] };
};

export function getFocusAreaData(category: PlannerCategory | FocusArea): FocusAreaData {
  const categoryId = typeof category === "string" ? category : category.id;
  const legacy = categoryId === "career" || categoryId === "content" ? categoryId : "other";
  const categoryRecord: PlannerCategory = typeof category === "string" ? { id: category, name: category === "career" ? "Career" : category === "content" ? "Content" : "Personal", icon: category === "career" ? "briefcase" : category === "content" ? "clapperboard" : "coffee", color: category === "content" ? "purple" : category === "career" ? "orange" : "teal", position: 0, archivedAt: null, revision: 1, createdAt: "", updatedAt: "" } : category;
  const active = db.select().from(tasks)
    .where(and(or(eq(tasks.categoryId, categoryId), eq(tasks.category, legacy)), notInArray(tasks.status, ["completed", "skipped"])))
    .orderBy(asc(tasks.date), asc(tasks.position), asc(tasks.id)).all();
  const completed = db.select().from(tasks)
    .where(and(or(eq(tasks.categoryId, categoryId), eq(tasks.category, legacy)), eq(tasks.status, "completed")))
    .orderBy(desc(tasks.completedAt), desc(tasks.id)).all();
  const allMilestones = db.select().from(contentMilestones)
    .where(or(eq(contentMilestones.categoryId, categoryId), eq(contentMilestones.category, legacy === "career" ? "career" : "content")))
    .orderBy(asc(contentMilestones.createdAt), asc(contentMilestones.id)).all();
  return {
    category: categoryRecord, active, completed,
    milestones: {
      active: allMilestones.filter((milestone) => !milestone.achievedAt),
      achieved: allMilestones.filter((milestone) => milestone.achievedAt)
        .sort((a, b) => b.achievedAt!.localeCompare(a.achievedAt!)),
    },
  };
}

type MilestoneValues = { label: string; type: FocusMilestone["type"]; targetValue?: number };

function milestoneCategoryWhere(category: FocusArea) {
  return category === "career" || category === "content"
    ? eq(contentMilestones.category, category)
    : eq(contentMilestones.categoryId, category);
}

export function createFocusMilestone(category: FocusArea, values: MilestoneValues) {
  const now = new Date().toISOString();
  const legacy = category === "career" ? "career" : "content";
  return db.insert(contentMilestones).values({ category: legacy, categoryId: category === "career" || category === "content" ? null : category, ...values, targetValue: values.targetValue ?? null, createdAt: now, updatedAt: now }).returning().get();
}

export function updateFocusMilestone(id: number, category: FocusArea, values: MilestoneValues) {
  return db.update(contentMilestones).set({ ...values, targetValue: values.targetValue ?? null, updatedAt: new Date().toISOString() }).where(and(eq(contentMilestones.id, id), milestoneCategoryWhere(category))).run().changes > 0;
}

export function setFocusMilestoneAchieved(id: number, category: FocusArea, achieved: boolean) {
  const now = new Date().toISOString();
  return db.update(contentMilestones).set({ achievedAt: achieved ? now : null, updatedAt: now }).where(and(eq(contentMilestones.id, id), milestoneCategoryWhere(category))).run().changes > 0;
}

export function deleteFocusMilestone(id: number, category: FocusArea) {
  return db.delete(contentMilestones).where(and(eq(contentMilestones.id, id), milestoneCategoryWhere(category))).run().changes > 0;
}
