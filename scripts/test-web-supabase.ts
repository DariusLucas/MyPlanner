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

const navigation = read("src/lib/navigation.ts");
assert.match(navigation, /label:\s*["']Today["'],\s*href:\s*["']\/["']/, "the canonical landing navigation is Today");
assert.doesNotMatch(navigation, /label:\s*["']Dashboard["']/, "Dashboard is no longer a user-facing navigation label");

const todayCompatibilityRoute = read("src/app/today/page.tsx");
assert.match(todayCompatibilityRoute, /redirect\(["']\/["']\)/, "/today redirects to the canonical landing route");

const todayLanding = read("src/components/dashboard-view.tsx");
const checklistIndex = todayLanding.indexOf('<div className="grid items-start gap-6');
const activityIndex = todayLanding.indexOf("<WeekCompletionStrip");
const streakIndex = todayLanding.indexOf('<StreakBanner streak={data.streak} />');
assert.ok(checklistIndex >= 0 && streakIndex >= 0 && streakIndex < checklistIndex, "the compact streak stays inside the Today hero before the checklist");
assert.equal((todayLanding.match(/<StreakBanner streak=\{data\.streak\} \/>/g) ?? []).length, 1, "Today renders exactly one compact streak signal");
assert.ok(activityIndex > checklistIndex, "weekly completion follows the Today checklist");
assert.match(todayLanding, /progressCounts\.planned === 0 \? "Nothing left today"/, "an unplanned day states plainly that nothing is left");
assert.match(todayLanding, /`\$\{progressCounts\.completed\} of \$\{progressCounts\.planned\} complete`/, "daily completed/planned stays visible");
assert.match(todayLanding, /progressCounts\.planned > 0 && <ProgressDial completed=\{progressCounts\.completed\} total=\{progressCounts\.planned\} \/>/, "daily completion percentage appears only when there is planned work");
assert.doesNotMatch(todayLanding, /function EmptyToday\(\{ completed, onAdd \}/, "the empty Today state does not duplicate the global Add task action");
assert.match(todayLanding, /aria-label=\{label\}/, "each weekly completion day exposes a plain-text accessible label");
assert.match(todayLanding, /aria-current=\{day\.date === today \? "date" : undefined\}/, "the current day is identified semantically");

const progressView = read("src/components/progress-view.tsx");
assert.ok(progressView.indexOf('{ label: "Tasks completed"') < progressView.indexOf('{ label: "Current streak"'), "Progress leads with finished work before supporting streaks");
assert.match(progressView, /<ActivityLegend \/>/, "Progress retains a visible activity legend");
assert.match(progressView, /aria-label=\{day\.inRange \? detail : undefined\}/, "Progress heatmap cells retain accessible labels");

const styles = read("src/app/globals.css");
const focusArea = read("src/components/focus-area-view.tsx");
assert.ok(focusArea.indexOf('<TaskSection title="Active"') < focusArea.indexOf("<MilestonesPanel"), "focused workspaces put active tasks before supporting milestones");
const modalBackdrop = styles.match(/\.modal-backdrop\s*\{([\s\S]*?)\}/)?.[1] ?? "";
assert.doesNotMatch(modalBackdrop, /backdrop-filter/, "modal backdrop avoids live backdrop recompositing");
assert.match(styles, /body:has\(\.modal-backdrop, \.thought-dialog-backdrop\) \.workspace-frame/, "modal blur is applied to one composited workspace layer");

const publicEnvironment = read("src/lib/supabase/env.ts");
assert.doesNotMatch(publicEnvironment, /SERVICE_ROLE|DB_URL|POOLER_URL|DATABASE_URL/,
  "public environment validation accepts only browser-safe configuration");

console.log("Web Supabase boundary, auth guard, revision, and secret-exposure checks passed.");
