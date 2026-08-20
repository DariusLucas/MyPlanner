import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const read = (file: string) => readFileSync(path.join(workspace, file), "utf8");

const config = read("capacitor.config.ts");
assert.match(config, /appId:\s*["']com\.myplanner\.app["']/);
assert.match(config, /webDir:\s*["']dist-mobile["']/);

const vite = read("mobile/vite.config.ts");
for (const alias of [
  ["@/src/app/today/actions", "./src/actions/tasks.ts"],
  ["@/src/app/dashboard-actions", "./src/actions/thoughts.ts"],
  ["@/src/app/content-actions", "./src/actions/milestones.ts"],
]) {
  assert.ok(vite.includes(alias[0]), `Missing Vite alias for ${alias[0]}`);
  assert.ok(vite.includes(alias[1]), `Missing mobile replacement ${alias[1]}`);
}

const database = read("mobile/src/database.ts");
for (const table of ["app_settings", "tasks", "task_recurrences", "daily_focus", "quick_thoughts", "content_milestones"]) {
  assert.match(database, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(database, /@capacitor-community\/sqlite/);

const app = read("mobile/src/mobile-app.tsx");
for (const route of ["/", "/week", "/today", "/career", "/content", "/progress"]) {
  assert.ok(app.includes(`\"${route}\"`), `Missing mobile route ${route}`);
}
assert.match(app, /kind:\s*["']settings["']/);

const progress = read("src/components/progress-view.tsx");
assert.match(progress, /window\.location\.hash\.startsWith\(["']#\/["']\)/);
assert.match(progress, /window\.location\.hash = `\$\{route\}\?\$\{params\}`/);
assert.match(progress, /addEventListener\(["']hashchange["']/);

const androidManifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(androidManifest, /android\.intent\.category\.LAUNCHER/);

console.log("Mobile runtime contract tests passed.");
