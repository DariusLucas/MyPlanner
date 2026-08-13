import { seedFoundation } from "../src/db/seed";

const result = seedFoundation();
console.log(result.inserted ? "Foundation data seeded." : "Foundation data already exists; nothing changed.");
