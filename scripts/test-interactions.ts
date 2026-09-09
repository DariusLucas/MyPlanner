import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const primitives = read("src/components/interaction-primitives.tsx");
const interaction = read("src/lib/interaction.ts");
const dashboard = read("src/components/dashboard-view.tsx");
const week = read("src/components/week-view.tsx");
const focus = read("src/components/focus-area-view.tsx");
const today = read("src/components/today-view.tsx");
const shell = read("src/components/app-shell.tsx");
const mobile = read("mobile/src/mobile-app.tsx");
const settingsAccount = read("src/components/settings-account-card.tsx");
const css = read("src/app/globals.css");

for (const [name, source] of Object.entries({ dashboard, week, focus, today })) {
  assert.match(source, /TaskCompletionButton/, `${name} uses the shared task completion control`);
}
assert.match(interaction, /COMPLETION_UNDO_MS = 5_000/, "Undo has one documented five-second duration");
assert.match(dashboard, /COMPLETION_UNDO_MS/, "Today completion feedback uses the shared Undo duration");
assert.doesNotMatch(today, /`Undo \$\{task\.title\}`/, "completed task language is Reopen rather than Undo outside the timed toast");

assert.match(primitives, /event\.key === "Escape"/, "dialog contract handles Escape");
assert.match(primitives, /event\.key !== "Tab"/, "dialog contract traps Tab navigation");
assert.match(primitives, /opener[\s\S]*\.focus\(\)/, "dialog contract returns focus to its opener");
for (const [name, source] of Object.entries({ dashboard, week, today, shell })) {
  assert.match(source, /useDialogContract/, `${name} uses the shared dialog contract`);
}
assert.match(mobile, /ConfirmationDialog/, "Android sign-out uses the shared confirmation dialog");
assert.match(settingsAccount, /ConfirmationDialog/, "mobile web Settings confirms before signing out");
assert.match(settingsAccount, /Are you sure you want to sign out of this planner\?/, "mobile web sign-out explains the pending action");

for (const token of ["--radius-dialog", "--motion-standard", "--color-modal-scrim", "--z-dialog", "--z-toast"]) {
  assert.ok(css.includes(token), `${token} semantic token is defined`);
}
assert.match(css, /\.task-composer\s*>\s*:last-child[\s\S]*position:\s*sticky/, "dialog actions stay visible on short viewports");
assert.match(css, /\.task-composer\s*>\s*:last-child\s*\{[^}]*border-radius:\s*18px;[^}]*background:\s*transparent/, "task action rows cannot create sharp tinted inner corners");
assert.match(css, /\.confirm-dialog \.dialog-actions\s*\{[^}]*position:\s*static;[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*none;[^}]*box-shadow:\s*none/, "confirmation actions remain plain without a footer layer");
assert.match(css, /@media \(max-height: 600px\)/, "short viewport and Android keyboard layout is covered");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\*::before[\s\S]*animation-duration:\s*0\.01ms/, "reduced motion covers all component animation layers");

console.log("Shared completion, dialog accessibility, responsive action, token, and reduced-motion contracts passed.");
