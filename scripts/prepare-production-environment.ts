import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const destination = path.join(process.cwd(), ".env.production.local");

if (fs.existsSync(destination)) {
  throw new Error(".env.production.local already exists; refusing to overwrite production secrets.");
}

const databasePassword = randomBytes(36).toString("base64url");
const template = `# MyPlanner production Supabase configuration. Never commit this file.
NEXT_PUBLIC_SUPABASE_URL=replace-with-production-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-production-publishable-key
VITE_SUPABASE_URL=replace-with-production-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=replace-with-production-publishable-key
NEXT_PUBLIC_SITE_URL=https://replace-with-public-site-domain
NEXT_PUBLIC_PUBLISHER_NAME=replace-with-publisher-name
NEXT_PUBLIC_SUPPORT_EMAIL=replace-with-monitored-support-email

SUPABASE_SERVICE_ROLE_KEY=replace-with-production-service-role-key
SUPABASE_DB_URL=replace-with-production-session-pooler-url
SUPABASE_POOLER_URL=replace-with-production-transaction-pooler-url
SUPABASE_DB_PASSWORD=${databasePassword}
`;

fs.writeFileSync(destination, template, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log("Prepared ignored .env.production.local with a generated database password.");

