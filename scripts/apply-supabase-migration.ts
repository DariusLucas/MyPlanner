import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

async function main() {
  // npm consumes options such as --env-file when forwarding arguments to tsx,
  // leaving the environment filename as a positional argument. Normalize it
  // before resolving the database target so production migrations cannot
  // silently fall back to .env.local.
  const positionalEnvFile = process.argv.slice(2).find((argument) => argument.endsWith(".local"));
  if (positionalEnvFile && !process.argv.some((argument) => argument.startsWith("--env-file"))) {
    process.argv.push(`--env-file=${positionalEnvFile}`);
  }

  const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");
  const requested = process.argv.find((argument) => /^\d{14}_[a-z0-9_]+\.sql$/.test(argument));
  const requestedFiles = process.argv.includes("--all")
    ? fs.readdirSync(migrationsDirectory).filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort()
    : requested
      ? [requested]
      : [];
  if (!requestedFiles.length) {
    throw new Error("Pass one migration filename or --all.");
  }

  const { databaseUrl, isDevelopment, projectRef } = getLocalSupabaseEnvironment();
  if (
    !isDevelopment &&
    !process.argv.includes("--confirm-production") &&
    process.env.SUPABASE_CONFIRM_PRODUCTION !== "1"
  ) {
    throw new Error(
      `Refusing to migrate non-development project ${projectRef} without --confirm-production.`,
    );
  }
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("create schema if not exists supabase_migrations");
    await client.query(`
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      )
    `);
    for (const migrationFile of requestedFiles) {
      const migrationPath = path.join(migrationsDirectory, migrationFile);
      if (!fs.existsSync(migrationPath)) throw new Error(`Migration not found: ${migrationFile}`);
      const version = migrationFile.slice(0, 14);
      const name = migrationFile.slice(15, -4);
      const sql = fs.readFileSync(migrationPath, "utf8");
      const existing = await client.query(
        "select 1 from supabase_migrations.schema_migrations where version = $1",
        [version],
      );
      if (existing.rowCount) {
        console.log(`Migration ${version} is already applied.`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          `insert into supabase_migrations.schema_migrations (version, statements, name)
           values ($1, $2::text[], $3)`,
          [version, [sql], name],
        );
        await client.query("commit");
        console.log(`Applied Supabase migration ${version}.`);
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
