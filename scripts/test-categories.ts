import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoryIconNames } from "../src/lib/categories";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260911120000_user_categories.sql");
const deletion = read("supabase/migrations/20261003120000_atomic_category_deletion.sql");
const backup = read("supabase/migrations/20260911121000_categories_backup.sql");
const shell = read("src/components/app-shell.tsx");
const categoryDialog = read("src/components/category-dialog.tsx");
const taskActions = read("src/app/today/actions.ts");

assert.equal(new Set(categoryIconNames).size, categoryIconNames.length, "category icons must be unique");
assert.ok(categoryIconNames.length >= 20, "the icon picker should cover common parts of life");
assert.match(migration, /create table public\.categories/);
assert.match(migration, /update public\.tasks[\s\S]*set category_id/, "existing task categories must be backfilled");
assert.match(migration, /archived_at/, "category removal must preserve history");
assert.match(migration, /tasks_category_owner_fk/, "tasks must not reference another user's category");
assert.match(backup, /'schemaVersion', 2/, "backups must include the generalized category model");
assert.match(backup, /'categories'/, "backups must preserve category records");
assert.match(shell, /sidebar-category-scroll/, "desktop categories must stay bounded");
assert.match(shell, /mobile-spaces-sheet/, "mobile categories must use the Spaces launcher");
assert.match(categoryDialog, /categoryIconNames\.map/, "category creation must expose the curated icon list");
assert.match(categoryDialog, /Archive hides this category while keeping its history/, "archiving must explain history preservation");
assert.match(taskActions, /z\.string\(\)\.uuid\("Create or choose a category first\."\)/, "task creation must require a user-owned category id");
assert.match(deletion, /for update/i, "permanent deletion must lock the category row while checking references");
assert.match(deletion, /public\.tasks[\s\S]*public\.task_recurrences[\s\S]*public\.content_milestones/, "permanent deletion must preserve task, recurrence, and milestone history");
assert.match(deletion, /revoke all on function public\.delete_planner_category[\s\S]*grant execute[\s\S]*authenticated/i, "permanent deletion must be available only through the authenticated RPC");
assert.match(read("src/lib/supabase/planner.ts"), /rpc\("delete_planner_category"/, "web category deletion must use the atomic RPC");
assert.match(read("mobile/src/actions/categories.ts"), /rpc\("delete_planner_category"/, "Android category deletion must use the atomic RPC");
assert.match(categoryDialog, /pathname === `\/category\/\$\{category\.id\}`\) router\.push\("\/"\)/, "removing the open category returns to the planner instead of a missing page");

console.log("User-defined category schema, safety, icon, and navigation contracts passed.");
