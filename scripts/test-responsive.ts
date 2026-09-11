import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const shell = fs.readFileSync("src/components/app-shell.tsx", "utf8");
const dashboard = fs.readFileSync("src/components/dashboard-view.tsx", "utf8");
const focus = fs.readFileSync("src/components/focus-area-view.tsx", "utf8");
const week = fs.readFileSync("src/components/week-view.tsx", "utf8");
const progress = fs.readFileSync("src/components/progress-view.tsx", "utf8");
const interactions = fs.readFileSync("src/components/interaction-primitives.tsx", "utf8");
const themeToggle = fs.readFileSync("src/components/theme-toggle.tsx", "utf8");

assert.match(css, /html\s*\{[^}]*min-width:\s*320px/, "the app keeps its supported minimum viewport");
assert.match(shell, /content-region min-w-0/, "the shell allows content to shrink without page overflow");
assert.match(shell, /className="mobile-bottom-nav lg:hidden"/, "mobile uses a dedicated bottom navigation surface");
assert.match(shell, /mobileNavigation\.map/, "mobile navigation exposes every planner destination");
assert.match(shell, /href === "\/settings" \? UserRound/, "Settings is presented as the mobile profile destination");
assert.doesNotMatch(shell, /"Profile"/, "the mobile account destination keeps the accurate Settings label");
assert.doesNotMatch(shell, /mobile-nav-button|mobile-nav-scrim|mobileOpen/, "legacy hamburger drawer state is removed");
assert.match(css, /\.mobile-bottom-nav-item\s*\{[^}]*height:\s*48px/, "mobile navigation targets stay comfortably sized");
assert.match(css, /\.mobile-bottom-nav-item\[data-active="true"\][^}]*flex-grow:\s*1\.72/, "the active mobile destination expands into a labelled capsule");
assert.match(css, /\.dark \.mobile-bottom-nav-item\[data-active="true"\]/, "only dark mode uses the dark active navigation capsule");
assert.match(css, /\.theme-toggle-indicator[^}]*transition:\s*transform 300ms/, "the theme selection indicator moves smoothly");
assert.match(css, /\.theme-toggle-labelled \.theme-option-button\s*\{[^}]*display:\s*flex[^}]*font-size:/, "labelled theme choices keep visible icon-and-text labels");
assert.match(themeToggle, /labelled && <span>\{label\}<\/span>/, "each labelled theme choice shows its plain-text label beside the icon");
assert.match(css, /\.content-surface\s*\{\s*padding-bottom:\s*calc\(6\.75rem/, "mobile content clears the floating navigation");

assert.match(css, /\.task-check\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/, "task completion targets stay touchable");
for (const [name, source] of [["Dashboard", dashboard], ["Career/Content", focus], ["This Week", week]] as const) {
  assert.match(source, /TaskCompletionButton/, `${name} uses the shared touch-target contract`);
}
assert.match(interactions, /task-check-surface/, "the shared control keeps a compact visual checkbox inside its larger hit target");

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
assert.match(css, /\.week-day-card-empty\s*\{[^}]*min-height:\s*108px/, "empty days stay compact instead of becoming large blank panels");
assert.match(css, /\.week-day-card-selected\s*\{[^}]*border-color:/, "the quick-add day remains visually identifiable");
assert.match(css, /\.week-day-select-button, \.routine-disclosure-button, \.routine-one-off-button\s*\{[^}]*min-height:\s*44px/, "planning choices remain touchable on narrow screens");
assert.match(week, /selected=\{selectedDate === date\}/, "the selected quick-add day is shared by web and Android layouts");
assert.match(week, /anytimeProgress\.total > 0/, "an empty flexible-work section does not show meaningless zero progress");
assert.match(week, /tasks\.length > 0 && <ProgressRing/, "empty day cards do not show meaningless zero progress rings");
assert.doesNotMatch(progress, /href=\{`\/progress\?/, "progress filters do not wait for a server navigation");
assert.match(progress, /window\.history\.pushState/, "progress filters keep the URL in sync without a route round trip");

console.log("Responsive shell, touch-target, dialog, chart, and mobile-table contracts passed.");
