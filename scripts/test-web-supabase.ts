import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const webRuntimeFiles = [
  "src/app/page.tsx",
  "src/app/[section]/page.tsx",
  "src/app/week/page.tsx",
  "src/app/today/actions.ts",
  "src/app/dashboard-actions.ts",
  "src/app/content-actions.ts",
  "src/lib/supabase/planner.ts",
];

for (const file of webRuntimeFiles) {
  const source = read(file);
  assert.doesNotMatch(source, /@\/src\/db|better-sqlite3|drizzle-orm/,
    `${file} does not depend on the SQLite runtime`);
  assert.doesNotMatch(source, /SUPABASE_DB_URL|SUPABASE_POOLER_URL|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/,
    `${file} does not reference privileged environment values`);
}

const middleware = read("src/middleware.ts");
assert.match(middleware, /auth\.getUser\(\)/, "middleware validates the current user");
assert.match(middleware, /target\.pathname = "\/login"/, "middleware redirects signed-out requests");
assert.match(
  middleware,
  /request\.method === "GET"/,
  "middleware redirects page navigation without intercepting server-action POSTs",
);

const planner = read("src/lib/supabase/planner.ts");
assert.match(planner, /import "server-only"/, "planner data access is server-only");
assert.match(planner, /p_expected_revision/, "planner mutations pass optimistic revisions");
assert.match(planner, /changed in another session/, "stale writes produce a visible conflict message");

const login = read("src/app/login/login-form.tsx");
assert.match(login, /requestEmailOtp/, "login requests an email code");
assert.match(login, /verifyEmailOtp/, "login verifies an email code");

const shell = read("src/components/app-shell.tsx");
assert.match(shell, /aria-labelledby="sign-out-title"/, "sign out uses an app-native confirmation dialog");
assert.doesNotMatch(shell, /window\.confirm/, "sign out does not use a browser alert");

const styles = read("src/app/globals.css");
const modalBackdrop = styles.match(/\.modal-backdrop\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert.doesNotMatch(modalBackdrop, /backdrop-filter/, "modal backdrop avoids live backdrop recompositing");
assert.match(styles, /body:has\(\.modal-backdrop, \.thought-dialog-backdrop\) \.workspace-frame/, "modal blur is applied to one composited workspace layer");

const publicEnvironment = read("src/lib/supabase/env.ts");
assert.doesNotMatch(publicEnvironment, /SERVICE_ROLE|DB_URL|POOLER_URL|DATABASE_URL/,
  "public environment validation accepts only browser-safe configuration");

console.log("Web Supabase boundary, auth guard, revision, and secret-exposure checks passed.");
