import fs from "node:fs";
import path from "node:path";

const developmentProjectRef = "uychwbumaseqbjkcyiyd";
const developmentSessionPoolerHost = "aws-1-eu-west-1.pooler.supabase.com";

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

function getRequestedEnvFile() {
  const inline = process.argv.find((argument) => argument.startsWith("--env-file="));
  if (inline) return inline.slice("--env-file=".length);

  const flagIndex = process.argv.indexOf("--env-file");
  if (flagIndex >= 0) {
    const value = process.argv[flagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Pass a file path after --env-file.");
    }
    return value;
  }

  return ".env.local";
}

export function getLocalSupabaseEnvironment() {
  const envPath = path.resolve(process.cwd(), getRequestedEnvFile());
  if (!fs.existsSync(envPath)) {
    throw new Error(`Supabase environment file not found: ${envPath}`);
  }

  const values = parseEnvFile(envPath);
  const databasePassword = values.get("SUPABASE_DB_PASSWORD");
  const configuredDatabaseUrl = values.get("SUPABASE_DB_URL");
  const supabaseUrl = values.get("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !publishableKey || publishableKey.startsWith("replace-with-")) {
    throw new Error(`Public Supabase configuration is incomplete in ${envPath}.`);
  }

  const parsedSupabaseUrl = new URL(supabaseUrl);
  const projectRef = parsedSupabaseUrl.hostname.split(".")[0];
  if (!projectRef) throw new Error(`Cannot derive a project reference from ${supabaseUrl}.`);

  let databaseUrl: URL;
  if (configuredDatabaseUrl && !configuredDatabaseUrl.includes("replace-with-")) {
    databaseUrl = new URL(configuredDatabaseUrl);
  } else {
    if (projectRef !== developmentProjectRef) {
      throw new Error(`SUPABASE_DB_URL is required for non-development project ${projectRef}.`);
    }
    if (!databasePassword || databasePassword.startsWith("replace-with-")) {
      throw new Error(`SUPABASE_DB_PASSWORD is not configured in ${envPath}.`);
    }
    databaseUrl = new URL(
      `postgresql://postgres.${projectRef}@${developmentSessionPoolerHost}:5432/postgres`,
    );
    databaseUrl.password = databasePassword;
  }

  return {
    databaseUrl: databaseUrl.toString(),
    envPath,
    isDevelopment: projectRef === developmentProjectRef,
    projectRef,
    publishableKey,
    supabaseUrl,
  };
}
