import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("My Planner"),
  theme: text("theme", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("system"),
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  defaultCareerTargetDays: integer("default_career_target_days").notNull().default(5),
  defaultWeeklyApplications: integer("default_weekly_applications").notNull().default(10),
  defaultWeeklyContent: integer("default_weekly_content").notNull().default(3),
  ...timestamps,
});

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["career", "content", "other"] }).notNull(),
  startDate: text("start_date").notNull(),
  targetDate: text("target_date"),
  status: text("status", { enum: ["active", "paused", "completed", "archived"] })
    .notNull()
    .default("active"),
  ...timestamps,
});

export const sprints = sqliteTable("sprints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status", { enum: ["planned", "active", "completed", "archived"] })
    .notNull()
    .default("planned"),
  ...timestamps,
});

export const sprintWeeks = sqliteTable(
  "sprint_weeks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sprintId: integer("sprint_id").notNull().references(() => sprints.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    title: text("title").notNull(),
    theme: text("theme"),
    outcome: text("outcome"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    ...timestamps,
  },
  (table) => ({
    sprintWeekNumber: uniqueIndex("sprint_week_number_idx").on(table.sprintId, table.weekNumber),
  }),
);

export const weeklyTargets = sqliteTable("weekly_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sprintWeekId: integer("sprint_week_id")
    .notNull()
    .references(() => sprintWeeks.id, { onDelete: "cascade" }),
  category: text("category", { enum: ["career", "content", "other"] }).notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  targetValue: integer("target_value").notNull(),
  ...timestamps,
});

export const dailyFocus = sqliteTable(
  "daily_focus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    careerMission: text("career_mission"),
    contentMission: text("content_mission"),
    ...timestamps,
  },
  (table) => ({
    dailyFocusDate: uniqueIndex("daily_focus_date_idx").on(table.date),
  }),
);

export const taskRecurrences = sqliteTable("task_recurrences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["career", "content", "other"] }).notNull(),
  priority: text("priority", { enum: ["high", "normal", "low"] }).notNull().default("normal"),
  estimatedMinutes: integer("estimated_minutes"),
  countPerWeek: integer("count_per_week").notNull(),
  startWeek: text("start_week").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["career", "content", "other"] }).notNull(),
  goalId: integer("goal_id").references(() => goals.id, { onDelete: "set null" }),
  sprintId: integer("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
  sprintWeekId: integer("sprint_week_id").references(() => sprintWeeks.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  anytimeWeekStart: text("anytime_week_start"),
  recurrenceId: integer("recurrence_id").references(() => taskRecurrences.id, { onDelete: "set null" }),
  recurrenceWeekStart: text("recurrence_week_start"),
  recurrenceIndex: integer("recurrence_index"),
  priority: text("priority", { enum: ["high", "normal", "low"] }).notNull().default("normal"),
  status: text("status", { enum: ["not_started", "in_progress", "on_hold", "done", "completed", "skipped"] })
    .notNull()
    .default("not_started"),
  position: integer("position").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes"),
  completedAt: text("completed_at"),
  ...timestamps,
}, (table) => ({
  dateStatus: index("tasks_date_status_idx").on(table.date, table.status),
  completedAt: index("tasks_completed_at_idx").on(table.completedAt),
  categoryStatus: index("tasks_category_status_idx").on(table.category, table.status),
  anytimeWeekStatus: index("tasks_anytime_week_status_idx").on(table.anytimeWeekStart, table.status),
  recurrenceInstance: uniqueIndex("tasks_recurrence_instance_idx").on(table.recurrenceId, table.recurrenceWeekStart, table.recurrenceIndex),
}));

export const contentMilestones = sqliteTable("content_milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", { enum: ["career", "content"] }).notNull().default("content"),
  label: text("label").notNull(),
  type: text("type", { enum: ["views", "likes", "followers", "applications", "interviews", "offers", "custom"] })
    .notNull()
    .default("custom"),
  targetValue: integer("target_value"),
  achievedAt: text("achieved_at"),
  ...timestamps,
}, (table) => ({
  achievedAt: index("content_milestones_achieved_at_idx").on(table.achievedAt),
  createdAt: index("content_milestones_created_at_idx").on(table.createdAt),
  categoryAchieved: index("content_milestones_category_achieved_idx").on(table.category, table.achievedAt),
}));

export const quickThoughts = sqliteTable("quick_thoughts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  ...timestamps,
}, (table) => ({
  createdAt: index("quick_thoughts_created_at_idx").on(table.createdAt),
}));
