import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const read = (file: string) => readFileSync(path.join(workspace, file), "utf8");

const config = read("capacitor.config.ts");
assert.match(config, /appId:\s*["']com\.myplanner\.app["']/);
assert.match(config, /webDir:\s*["']dist-mobile["']/);

const vite = read("mobile/vite.config.ts");
assert.match(vite, /envDir:\s*root/);
for (const alias of [
  ["@/src/app/today/actions", "./src/actions/tasks.ts"],
  ["@/src/app/dashboard-actions", "./src/actions/thoughts.ts"],
  ["@/src/app/content-actions", "./src/actions/milestones.ts"],
]) {
  assert.ok(vite.includes(alias[0]), `Missing Vite alias for ${alias[0]}`);
  assert.ok(vite.includes(alias[1]), `Missing mobile replacement ${alias[1]}`);
}

const supabase = read("mobile/src/supabase.ts");
assert.match(supabase, /@aparajita\/capacitor-secure-storage/);
assert.match(supabase, /persistSession:\s*true/);
assert.match(supabase, /detectSessionInUrl:\s*false/);
assert.doesNotMatch(supabase, /service_role|secret/i);

const repository = read("mobile/src/repository.ts");
for (const rpc of ["create_task", "update_planned_task", "set_task_completed", "delete_task", "move_task_to_tomorrow", "reorder_task", "set_task_workflow", "save_daily_focus"]) {
  assert.ok(repository.includes(`\"${rpc}\"`), `Missing mobile RPC ${rpc}`);
}

const app = read("mobile/src/mobile-app.tsx");
for (const route of ["/", "/week", "/today", "/career", "/content", "/progress"]) {
  assert.ok(app.includes(`\"${route}\"`), `Missing mobile route ${route}`);
}
assert.match(app, /kind:\s*["']settings["']/);
assert.match(app, /signInWithOtp|requestEmailOtp/);
assert.match(app, /postgres_changes/);
assert.doesNotMatch(app, /initializeDatabase/);
assert.match(app, /userEmail=\{session\.user\.email\}/, "Mobile sidebar must show the authenticated account");
assert.match(app, /screen\?\.href === route\.href/, "Mobile routes must not animate stale screen data");
assert.match(app, /MobilePageSkeleton/, "Mobile routes must render page skeletons while loading");
assert.doesNotMatch(app, /Opening your planner/, "Mobile loading must not show legacy loading copy");

const mobileLink = read("mobile/src/next-link.tsx");
assert.match(mobileLink, /prefetch/);
assert.match(mobileLink, /void \[prefetch, replace, scroll, shallow, locale\]/);

const mobileRouter = read("mobile/src/router.tsx");
assert.match(mobileRouter, /setHref\(nextHref\)/, "Mobile navigation must update React before Android hashchange");
assert.match(mobileRouter, /addEventListener\(["']popstate["']/, "Mobile navigation must preserve Android back navigation");

const mobileStyles = read("mobile/src/mobile.css");
assert.match(mobileStyles, /\.workspace-frame\s*\{[\s\S]*will-change:\s*auto/, "Mobile drawer must not inherit the desktop filter containing block");
assert.match(mobileStyles, /body:has\(button\[aria-label=["']Close navigation["']\]\.fixed\.inset-0\)[\s\S]*overflow:\s*hidden/, "Opening mobile navigation must lock page scrolling");
assert.match(mobileStyles, /\.sidebar-panel\s*\{[\s\S]*background:\s*var\(--background\)/, "Mobile drawer must be opaque");
assert.match(mobileStyles, /button\[aria-label=["']Close navigation["']\]\.fixed\.inset-0\s*\{[\s\S]*backdrop-filter:\s*none/, "Mobile drawer overlay must not blur the page");
assert.match(mobileStyles, /\.sidebar-panel \.nav-item[\s\S]*touch-action:\s*manipulation/, "Mobile drawer links must remain touchable");
assert.match(mobileStyles, /mobile-skeleton-shimmer/, "Mobile page skeleton animation is missing");

const realtimeMigration = read("supabase/migrations/20260826120000_android_realtime.sql");
for (const table of ["app_settings", "tasks", "task_recurrences", "daily_focus", "quick_thoughts", "content_milestones"]) {
  assert.ok(realtimeMigration.includes(`'${table}'`), `Missing Realtime publication table ${table}`);
}

const progress = read("src/components/progress-view.tsx");
assert.match(progress, /window\.location\.hash\.startsWith\(["']#\/["']\)/);
assert.match(progress, /window\.location\.hash = `\$\{route\}\?\$\{params\}`/);
assert.match(progress, /addEventListener\(["']hashchange["']/);

const androidManifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(androidManifest, /android\.intent\.category\.LAUNCHER/);

console.log("Mobile runtime contract tests passed.");
