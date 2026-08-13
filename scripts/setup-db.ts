import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/client";
import { seedFoundation } from "../src/db/seed";

migrate(db, { migrationsFolder: "./src/db/migrations" });
const result = seedFoundation();
console.log(result.inserted ? "Database ready and foundation data seeded." : "Database ready; foundation data already exists.");
