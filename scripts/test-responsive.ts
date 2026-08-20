import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const shell = fs.readFileSync("src/components/app-shell.tsx", "utf8");
const dashboard = fs.readFileSync("src/components/dashboard-view.tsx", "utf8");
const focus = fs.readFileSync("src/components/focus-area-view.tsx", "utf8");
const week = fs.readFileSync("src/components/week-view.tsx", "utf8");
const progress = fs.readFileSync("src/components/progress-view.tsx", "utf8");

assert.match(css, /html\s*\{[^}]*min-width:\s*320px/, "the app keeps its supported minimum viewport");
assert.match(shell, /content-region min-w-0/, "the shell allows content to shrink without page overflow");
assert.match(shell, /mobile-nav-button/g, "mobile navigation uses dedicated touch targets");
assert.match(css, /\.mobile-nav-button\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/, "mobile navigation targets stay comfortably sized");
assert.match(css, /\.mobile-nav-button\s*\{[^}]*display:\s*none/, "mobile navigation controls cannot leak into the desktop sidebar");
assert.match(css, /@media \(max-width: 1023px\)[\s\S]*\.mobile-nav-button \{ display: grid; \}/, "navigation drawer controls remain available below the desktop breakpoint");

assert.match(css, /\.task-check\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/, "task completion targets stay touchable");
for (const [name, source] of [["Dashboard", dashboard], ["Career/Content", focus], ["This Week", week]] as const) {
  assert.match(source, /task-check-surface/, `${name} keeps the compact visual checkbox inside its larger hit target`);
}

assert.match(css, /\.task-composer\s*\{[^}]*max-height:\s*calc\(100dvh - 2rem\)[^}]*overflow-y:\s*auto/, "task dialogs remain reachable on short screens");
assert.match(css, /\.progress-chart-scroll\s*\{[^}]*overflow-x:\s*auto/, "wide progress charts remain locally scrollable");
assert.match(css, /\.progress-month-table-wrap\s*\{\s*overflow:\s*visible/, "mobile monthly history switches away from a clipped wide table");
assert.match(css, /\.progress-month-table tr\s*\{[^}]*display:\s*grid/, "mobile monthly summaries render as readable cards");
for (const label of ["Month", "Completed", "Productive days", "Planned", "Completion rate"]) {
  assert.ok(progress.includes(`data-label="${label}"`), `monthly summaries expose the ${label} mobile label`);
}

assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.kanban-status-columns-desktop \{ display: none; \}/, "mobile hides the drag-oriented desktop columns");
assert.match(css, /\.kanban-mobile-board \{[^}]*display: block;[^}]*order: -1;/, "mobile renders the focused workflow before flexible tasks");
assert.match(css, /\.kanban-mobile-stage \{[^}]*min-height: 46px;/, "mobile workflow stages are touchable");
assert.match(week, /className="kanban-mobile-board"/, "the week view provides a mobile Kanban board");
assert.match(week, /role="tablist"[\s\S]*aria-label="Workflow stage"/, "mobile workflow stages are exposed as tabs");
assert.match(week, /kanban-mobile-move-label">Move task to/, "mobile cards explain their status control");
assert.match(week, /draggable=\{!mobile\}/, "mobile task cards disable drag behavior");
assert.match(week, /dataTransfer\.setData\("application\/x-myplanner-task"/, "desktop drag carries a stable task identifier");
assert.match(week, /optimisticStatuses/, "workflow moves render immediately while persistence finishes");
assert.doesNotMatch(week, /setDragOverStatus/, "native dragover events do not trigger render loops");
assert.match(week, /window\.setTimeout\(\(\) => void moveTask\(id, status\), 0\)/, "desktop drops finish their native lifecycle before relocating a card");
assert.match(week, /setMobileStatus\(status\);[\s\S]*void moveTask\(task\.id, status\)/, "mobile follows a task to its new workflow stage");
assert.doesNotMatch(progress, /href=\{`\/progress\?/, "progress filters do not wait for a server navigation");
assert.match(progress, /window\.history\.pushState/, "progress filters keep the URL in sync without a route round trip");

console.log("Responsive shell, touch-target, dialog, chart, and mobile-table contracts passed.");
