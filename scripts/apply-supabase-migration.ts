import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

async function main() {
  const requested = process.argv[2];
  if (!requested || !/^\d{14}_[a-z0-9_]+\.sql$/.test(requested)) {
    throw new Error("Pass one migration filename from supabase/migrations.");
  }
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", requested);
  if (!fs.existsSync(migrationPath)) throw new Error(`Migration not found: ${requested}`);
  const version = requested.slice(0, 14);
  const name = requested.slice(15, -4);
  const sql = fs.readFileSync(migrationPath, "utf8");
  const { databaseUrl } = getLocalSupabaseEnvironment();
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const existing = await client.query(
      "select 1 from supabase_migrations.schema_migrations where version = $1",
      [version],
    );
    if (existing.rowCount) {
      console.log(`Migration ${version} is already applied.`);
      return;
    }
    await client.query("begin");
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
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
