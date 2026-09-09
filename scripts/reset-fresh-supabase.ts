import assert from "node:assert/strict";
import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

const confirmation = "--confirm-development-reset";
const plannerTables = [
  "task_events",
  "tasks",
  "weekly_targets",
  "daily_focus",
  "content_milestones",
  "quick_thoughts",
  "sprint_weeks",
  "sprints",
  "task_recurrences",
  "goals",
  "app_settings",
] as const;

async function main() {
  assert.equal(
    process.argv[2],
    confirmation,
    `This command deletes planner rows in the development project. Re-run with ${confirmation}.`,
  );

  const { databaseUrl, projectRef } = getLocalSupabaseEnvironment();
  assert.equal(projectRef, "uychwbumaseqbjkcyiyd", "reset is restricted to the known development project");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("begin");
    const deleted: Record<string, number> = {};
    for (const tableName of plannerTables) {
      const result = await client.query(`delete from public."${tableName}"`);
      deleted[tableName] = result.rowCount ?? 0;
    }
    await client.query("commit");
    console.log("Development Supabase planner data reset completed.");
    console.log(`Deleted rows: ${JSON.stringify(deleted)}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
