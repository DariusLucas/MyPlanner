import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

async function main() {
  // `tsx` consumes unknown CLI flags, so npm may pass only the flag's value.
  const positionalEnvFile = process.argv.slice(2).find((argument) => argument.endsWith(".local"));
  if (
    positionalEnvFile &&
    !process.argv.some((argument) => argument.startsWith("--env-file"))
  ) {
    process.argv.push(`--env-file=${positionalEnvFile}`);
  }
  const { databaseUrl, projectRef } = getLocalSupabaseEnvironment();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query("begin read only");

    const migrations = await client.query<{ count: number; latest: string | null }>(`
      select count(*)::int as count, max(version) as latest
      from supabase_migrations.schema_migrations
    `);
    const rowSecurity = await client.query<{ count: number; missing: string[] }>(`
      select count(*)::int as count,
             coalesce(
               array_agg(table_row.relname order by table_row.relname)
                 filter (where not table_row.relrowsecurity),
               array[]::text[]
             ) as missing
      from pg_class as table_row
      join pg_namespace as namespace on namespace.oid = table_row.relnamespace
      where namespace.nspname = 'public'
        and table_row.relkind = 'r'
        and table_row.relname = any($1::text[])
    `, [[
      "app_settings", "goals", "sprints", "sprint_weeks", "weekly_targets",
      "daily_focus", "task_recurrences", "tasks", "content_milestones",
      "quick_thoughts", "task_events", "categories",
    ]]);
    const authCascades = await client.query<{ count: number }>(`
      select count(*)::int as count
      from pg_constraint as constraint_row
      join pg_class as referenced_table on referenced_table.oid = constraint_row.confrelid
      join pg_namespace as namespace on namespace.oid = referenced_table.relnamespace
      where namespace.nspname = 'auth'
        and referenced_table.relname = 'users'
        and constraint_row.contype = 'f'
        and constraint_row.confdeltype = 'c'
    `);
    const rpcSecurity = await client.query<{
      name: string;
      security_definer: boolean;
      anon_can_execute: boolean;
    }>(`
      select procedure.proname as name,
             procedure.prosecdef as security_definer,
             has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_can_execute
      from pg_proc as procedure
      join pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = any($1::text[])
      order by procedure.proname
    `, [[
      "create_task", "update_task", "delete_task", "complete_task",
      "create_or_update_recurrence",
    ]]);

    await client.query("rollback");
    console.log(JSON.stringify({
      projectRef,
      migrationHistory: migrations.rows[0],
      plannerRowLevelSecurity: rowSecurity.rows[0],
      authCascadeForeignKeys: authCascades.rows[0].count,
      keyRpcSecurity: rpcSecurity.rows,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown database audit error";
  console.error(`Read-only Supabase audit failed: ${message}`);
  process.exitCode = 1;
});
