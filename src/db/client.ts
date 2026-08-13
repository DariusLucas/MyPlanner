import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "planner.db");
const databaseDirectory = path.dirname(databaseUrl);

if (databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a local filesystem path, not a file URL.");
}

fs.mkdirSync(databaseDirectory, { recursive: true });

const globalForDatabase = globalThis as unknown as {
  sqlite?: Database.Database;
};

const sqlite = globalForDatabase.sqlite ?? new Database(databaseUrl);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
