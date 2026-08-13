import { defineConfig } from "drizzle-kit";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "planner.db");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
