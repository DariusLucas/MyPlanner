import assert from "node:assert/strict";
import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

const expectedMigrationVersions = [
  "20260822105102",
  "20260822130000",
  "20260822130100",
  "20260822130200",
  "20260822130300",
  "20260825120000",
  "20260826120000",
  "20260906120000",
];

const plannerTables = [
  "app_settings",
  "goals",
  "sprints",
  "sprint_weeks",
  "weekly_targets",
  "daily_focus",
  "task_recurrences",
  "tasks",
  "content_milestones",
  "quick_thoughts",
  "task_events",
] as const;

async function main() {
  const { databaseUrl } = getLocalSupabaseEnvironment();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const migrationHistory = await client.query<{ version: string }>(
      `select version
       from supabase_migrations.schema_migrations
       where version = any($1::text[])
       order by version`,
      [expectedMigrationVersions],
    );
    assert.deepEqual(
      migrationHistory.rows.map((row) => row.version),
      expectedMigrationVersions,
      "all committed Supabase migrations are applied",
    );

    const nonEmpty: Array<{ table: string; rowCount: string }> = [];
    for (const tableName of plannerTables) {
      const result = await client.query<{ row_count: string }>(
        `select count(*)::text as row_count from public."${tableName}"`,
      );
      const rowCount = result.rows[0]!.row_count;
      if (Number(rowCount) !== 0) nonEmpty.push({ table: tableName, rowCount });
    }
    assert.deepEqual(nonEmpty, [], "the development planner dataset is empty");

    console.log("Fresh Supabase preflight passed.");
    console.log(`Migrations: ${migrationHistory.rows.length}`);
    console.log("Planner tables: 0 rows");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
