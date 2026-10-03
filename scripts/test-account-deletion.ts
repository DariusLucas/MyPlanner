import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeNextPath } from "../src/lib/safe-next-path";

assert.equal(safeNextPath("/delete-account"), "/delete-account");
assert.equal(safeNextPath("/delete-account?from=play"), "/delete-account?from=play");
assert.equal(safeNextPath("https://attacker.example/path"), "/");
assert.equal(safeNextPath("//attacker.example/path"), "/");
assert.equal(safeNextPath("/\\attacker.example/path"), "/");

const edge = readFileSync("supabase/functions/delete-account/index.ts", "utf8");
assert.match(edge, /request\.method !== "POST"/);
assert.match(edge, /authorization\?\.startsWith\("Bearer "\)/);
assert.match(edge, /body\.confirm !== true/);
assert.match(edge, /admin\.auth\.getUser\(token\)/);
assert.match(edge, /admin\.auth\.admin\.deleteUser\(data\.user\.id\)/);
assert.doesNotMatch(edge, /deleteUser\([^)]*request|deleteUser\([^)]*body/);

const schema = readFileSync("supabase/migrations/20260822130000_planner_schema.sql", "utf8");
const categories = readFileSync("supabase/migrations/20260911120000_user_categories.sql", "utf8");
const cascades = `${schema}\n${categories}`.match(/references auth\.users\(id\) on delete cascade/gi) ?? [];
assert.ok(cascades.length >= 11, "planner-owned data tables must cascade when an Auth account is deleted");

console.log("Account deletion authorization, safe redirect, and data cascade checks passed.");
