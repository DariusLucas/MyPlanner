import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
  type capSQLiteChanges,
} from "@capacitor-community/sqlite";

const database = "planner";
let initialization: Promise<void> | null = null;
const manager = new SQLiteConnection(CapacitorSQLite);
let connection: SQLiteDBConnection;

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
  name TEXT DEFAULT 'My Planner' NOT NULL,
  theme TEXT DEFAULT 'system' NOT NULL,
  week_starts_on INTEGER DEFAULT 1 NOT NULL,
  default_career_target_days INTEGER DEFAULT 5 NOT NULL,
  default_weekly_applications INTEGER DEFAULT 10 NOT NULL,
  default_weekly_content INTEGER DEFAULT 3 NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_date TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'planned' NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS sprint_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  theme TEXT,
  outcome TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sprint_week_number_idx ON sprint_weeks(sprint_id, week_number);
CREATE TABLE IF NOT EXISTS weekly_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  sprint_week_id INTEGER NOT NULL REFERENCES sprint_weeks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_focus (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date TEXT NOT NULL,
  career_mission TEXT,
  content_mission TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_focus_date_idx ON daily_focus(date);
CREATE TABLE IF NOT EXISTS task_recurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' NOT NULL,
  estimated_minutes INTEGER,
  count_per_week INTEGER NOT NULL,
  start_week TEXT NOT NULL,
  active INTEGER DEFAULT 1 NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
  sprint_week_id INTEGER REFERENCES sprint_weeks(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  anytime_week_start TEXT,
  recurrence_id INTEGER REFERENCES task_recurrences(id) ON DELETE SET NULL,
  recurrence_week_start TEXT,
  recurrence_index INTEGER,
  priority TEXT DEFAULT 'normal' NOT NULL,
  status TEXT DEFAULT 'not_started' NOT NULL,
  position INTEGER DEFAULT 0 NOT NULL,
  estimated_minutes INTEGER,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_date_status_idx ON tasks(date, status);
CREATE INDEX IF NOT EXISTS tasks_anytime_week_status_idx ON tasks(anytime_week_start, status);
CREATE INDEX IF NOT EXISTS tasks_completed_at_idx ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS tasks_category_status_idx ON tasks(category, status);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_instance_idx ON tasks(recurrence_id, recurrence_week_start, recurrence_index);
CREATE TABLE IF NOT EXISTS quick_thoughts (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS quick_thoughts_created_at_idx ON quick_thoughts(created_at);
CREATE TABLE IF NOT EXISTS content_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  category TEXT DEFAULT 'content' NOT NULL,
  label TEXT NOT NULL,
  type TEXT DEFAULT 'custom' NOT NULL,
  target_value INTEGER,
  achieved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS content_milestones_achieved_at_idx ON content_milestones(achieved_at);
CREATE INDEX IF NOT EXISTS content_milestones_created_at_idx ON content_milestones(created_at);
CREATE INDEX IF NOT EXISTS content_milestones_category_achieved_idx ON content_milestones(category, achieved_at);
INSERT OR IGNORE INTO app_settings(id) VALUES (1);
PRAGMA user_version = 1;
`;

async function initialize() {
  const existing = await manager.isConnection(database, false);
  connection = existing.result
    ? await manager.retrieveConnection(database, false)
    : await manager.createConnection(database, false, "no-encryption", 1, false);
  const open = await connection.isDBOpen();
  if (!open.result) await connection.open();
  await connection.execute(schema, true);
}

export function initializeDatabase() {
  initialization ??= initialize().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

type SqlValue = string | number | null;

export async function query<T>(statement: string, values: SqlValue[] = []) {
  await initializeDatabase();
  const result = await connection.query(statement, values);
  return (result.values ?? []) as T[];
}

export async function run(statement: string, values: SqlValue[] = []) {
  await initializeDatabase();
  return connection.run(statement, values, false);
}

export async function execute(statements: string, transaction = true) {
  await initializeDatabase();
  return connection.execute(statements, transaction);
}

export async function transaction<T>(operation: () => Promise<T>) {
  await initializeDatabase();
  await connection.beginTransaction();
  try {
    const result = await operation();
    await connection.commitTransaction();
    return result;
  } catch (error) {
    await connection.rollbackTransaction();
    throw error;
  }
}

export function changed(result: capSQLiteChanges) {
  return (result.changes?.changes ?? 0) > 0;
}

export type MobileTask = {
  id: number;
  title: string;
  description: string | null;
  category: "career" | "content" | "other";
  goalId: number | null;
  sprintId: number | null;
  sprintWeekId: number | null;
  date: string;
  anytimeWeekStart: string | null;
  recurrenceId: number | null;
  recurrenceWeekStart: string | null;
  recurrenceIndex: number | null;
  priority: "high" | "normal" | "low";
  status: "not_started" | "in_progress" | "on_hold" | "done" | "completed" | "skipped";
  position: number;
  estimatedMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  category: MobileTask["category"];
  goal_id: number | null;
  sprint_id: number | null;
  sprint_week_id: number | null;
  date: string;
  anytime_week_start: string | null;
  recurrence_id: number | null;
  recurrence_week_start: string | null;
  recurrence_index: number | null;
  priority: MobileTask["priority"];
  status: MobileTask["status"];
  position: number;
  estimated_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapTask(row: TaskRow): MobileTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    goalId: row.goal_id,
    sprintId: row.sprint_id,
    sprintWeekId: row.sprint_week_id,
    date: row.date,
    anytimeWeekStart: row.anytime_week_start,
    recurrenceId: row.recurrence_id,
    recurrenceWeekStart: row.recurrence_week_start,
    recurrenceIndex: row.recurrence_index,
    priority: row.priority,
    status: row.status,
    position: row.position,
    estimatedMinutes: row.estimated_minutes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function taskById(id: number) {
  const [row] = await query<TaskRow>("SELECT * FROM tasks WHERE id = ? LIMIT 1", [id]);
  return row ? mapTask(row) : undefined;
}

export async function allTasks(where = "", values: SqlValue[] = [], order = "date, position, id") {
  const rows = await query<TaskRow>(`SELECT * FROM tasks ${where ? `WHERE ${where}` : ""} ORDER BY ${order}`, values);
  return rows.map(mapTask);
}
