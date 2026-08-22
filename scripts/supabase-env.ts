import fs from "node:fs";
import path from "node:path";

const projectRef = "uychwbumaseqbjkcyiyd";
const sessionPoolerHost = "aws-1-eu-west-1.pooler.supabase.com";

function parseEnvFile(filePath: string) {
  const values = new Map<string, string>();
  const contents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }

  return values;
}

export function getLocalSupabaseEnvironment() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local is required for Supabase development commands.");
  }

  const values = parseEnvFile(envPath);
  const databasePassword = values.get("SUPABASE_DB_PASSWORD");
  const supabaseUrl = values.get("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!databasePassword || databasePassword.startsWith("replace-with-")) {
    throw new Error("SUPABASE_DB_PASSWORD is not configured in .env.local.");
  }
  if (!supabaseUrl || !publishableKey || publishableKey.startsWith("replace-with-")) {
    throw new Error("Public Supabase configuration is incomplete in .env.local.");
  }

  const databaseUrl = new URL(
    `postgresql://postgres.${projectRef}@${sessionPoolerHost}:5432/postgres`,
  );
  databaseUrl.password = databasePassword;

  return {
    databaseUrl: databaseUrl.toString(),
    projectRef,
    publishableKey,
    supabaseUrl,
  };
}
