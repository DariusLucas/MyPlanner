# MyPlanner UI/UX Audit

**Date:** 2026-08-25  
**Scope:** Read-only walkthrough of the authenticated web app in Chrome, plus source and mobile-shell review.  
**Roadmap status:** Adopted as the post-S6 UI/UX roadmap on 2026-09-06. The
approved visual design remains unchanged.

## Implementation status

- Phase A was completed by Supabase phases S3 through S6: mobile uses the
  authenticated Supabase runtime, Settings describes the shared cloud model,
  and router-only link props are stripped from mobile anchors.
- Phase B was completed as Phase U1 on 2026-09-06: the landing navigation is
  Today, `/today` resolves to `/`, the active checklist leads the content,
  daily metrics remain visible for empty and populated days, and streak is a
  compact supporting signal below actionable content.
- Phase C was completed as Phase U2 on 2026-09-06: Today now includes a
  compact Monday-through-Sunday completion strip, selected-day totals,
  current-day identification, non-color fractions, and accessible labels;
  Progress retains its full historical heatmap and visible legend.
- Phase D was completed as Phase U3 on 2026-09-08: task views now share one
  completion control and consistent Reopen language; the five-second Today
  Undo stays immediate and revision-safe; dialogs share focus entry, trapping,
  safe Escape, focus return, announcements, and short-viewport behavior; and
  semantic design tokens plus reduced-motion coverage apply to web and Android.
- Phase E is prepared as Phase U4.

## Executive summary

MyPlanner already has a cohesive visual foundation: the orange accent, dark/light theme approach, sidebar, typography, generous spacing, and rounded surfaces feel intentional and calm. The dashboard also already contains the beginnings of the daily-progress experience: completed/total, remaining count, and a percentage progress visual.

The main UX gap is hierarchy. The app is organized around several equally weighted workspaces, while the product promise is simpler: open the app and immediately know what matters today, complete it with almost no friction, and see progress without hunting through another page. “Dashboard” is a generic label for that job, the streak is visually separated from the checklist, and the richer progress view is disconnected from the moment-to-moment Today experience.

The recommended direction is a Today-first shell:

1. Make Today the navigation and mental model for the landing screen.
2. Keep the active checklist as the first and strongest content.
3. Put a compact daily-progress summary directly beside or immediately below it.
4. Add a small date/activity strip for quick visual context; keep the full historical heatmap in Progress.
5. Standardize task completion, modal behavior, motion, radiuses, and semantic colors across all workspaces.

## Walkthrough coverage

The following routes and flows were opened in the user’s existing authenticated Chrome session:

- Landing screen (`/`, currently labeled **Dashboard**)
- Dashboard **Add a task** modal
- **This Week** checklist view (`/week`)
- **This Week** Kanban view
- **Career** workspace (`/career`)
- **Content** workspace (`/content`)
- **Progress** history view (`/progress`)
- **Settings** (`/settings`)
- Mobile Vite preview at `http://127.0.0.1:5173/`

No tasks, milestones, notes, settings, or other planner data were created, edited, completed, or deleted during the audit.

## What is working well

- The dark theme has a warm, distinctive personality and the orange accent is easy to recognize.
- Sidebar navigation is simple and visually consistent across the web routes.
- The dashboard’s empty state is calm and encouraging: “A clear day, ready when you are.”
- The Today card gives useful at-a-glance metrics: completed/total, remaining, and percentage progress.
- The Add Task flow is understandable and supports a useful distinction between a flexible task, a specific day, and a weekly repeat target.
- The week view has a clear checklist/Kanban mode switch and keeps the current day identifiable.
- Career and Content reuse the same workspace language instead of feeling like unrelated products.
- Progress has a sensible time-range and category filter model.
- Touch-target and responsive checks are already passing; preserve that baseline when changing the UI.
- Reduced-motion handling exists in the web stylesheet and should be extended to all motion-producing surfaces.

## Findings and recommendations

### P0 — Phase/S4 runtime and product-contract issues

#### 1. Mobile preview fails before the planner can be used

The mobile Vite preview rendered the shell, then displayed an error because the Capacitor SQLite web adapter could not find the `jeep-sqlite` element in the DOM:

> The jeep-sqlite element is not present in the DOM!

This is a functional blocker for the mobile experience, not merely a polish issue. It should be resolved as part of S4’s Android/data-layer work, or the web preview should be switched fully to the new Supabase path so the old SQLite web adapter is not initialized there.

Relevant areas: `mobile/src/main.tsx`, `mobile/src/database.ts`, and `mobile/src/mobile-app.tsx`.

#### 2. Mobile Settings copy describes the old storage model

The mobile Settings screen currently says:

- Works offline
- On-device SQLite
- No remote account
- Separate mobile data

That conflicts with the active S4 migration requirements for Supabase authentication, secure session handling, realtime behavior, and shared data expectations. The copy should be updated only when the S4 implementation is ready, but it must not ship with contradictory storage/auth messaging.

#### 3. Mobile link shim forwards unsupported props to the DOM

The mobile `Link` shim spreads navigation props directly onto an anchor. The live preview logged a React warning for the non-boolean `prefetch` attribute. Strip router-only props before rendering the native anchor. Warnings like this are easy to ignore, but they make runtime diagnosis harder and can become browser-facing markup bugs.

Relevant area: `mobile/src/next-link.tsx`.

### P1 — The Today experience should be the primary loop

#### 4. “Dashboard” is a weaker name than “Today”

The landing route is the place where the user asks, “What do I need to do today?” A generic Dashboard label implies reporting or configuration rather than action. The current `/today` route redirects to `/week`, which further weakens the mental model.

Recommended future behavior:

- Rename the primary navigation label from **Dashboard** to **Today**.
- Keep `/` as the canonical landing route to avoid unnecessary URL churn.
- Let `/today` redirect to `/` for compatibility, not to `/week`.
- Use “Today” consistently in page titles, empty states, keyboard/navigation labels, and any mobile navigation.

#### 5. The streak competes with the checklist instead of supporting it

On the landing screen, the streak banner appears before the Today card. It is full-width and visually prominent, while the checklist—the core Do step—is below it. With no data, the banner reads “0 productive days,” which can feel like a negative score before the user has even seen the work.

Recommended future hierarchy:

- Put active tasks first.
- Keep daily completion beside the task heading or directly under the active list.
- Make streak a compact supporting signal such as “0-day streak” or a secondary row.
- Reserve celebratory streak treatment for meaningful progress or completion moments.

#### 6. Daily progress exists, but it is not yet a strong habit loop

The dashboard currently shows `0 of 0 complete`, `0 remaining`, and `0%`, so the requested daily-progress concept is partially present. The empty state, however, does not teach the user what progress will look like after work is added, and the progress history is only visible on a separate route.

Recommended future dashboard summary:

- `completed / planned` as the primary number.
- Remaining count as a secondary action-oriented number.
- A compact ring or bar with a clear accessible text equivalent.
- A small “today’s momentum” or completion timeline that becomes useful once tasks exist.
- A direct link to the full Progress history only when the user wants deeper review.

Do not replace the checklist with a large chart. The progress visual should help the next action, not become another page to interpret.

#### 7. Add a compact day/activity strip instead of putting a full GitHub heatmap on the dashboard

The requested GitHub-style visualization is a good fit for seeing consistency over time, but a full 365-cell heatmap would compete with today’s tasks and make the landing screen feel like an analytics dashboard.

Recommended split:

- **Today:** a compact seven-day strip (or small week heatmap) with today highlighted, each day showing completion intensity and a tooltip/accessible label such as “Tuesday: 3 of 5 complete.”
- **Today detail:** selecting a day updates the compact summary to that day, without forcing the user through several pages.
- **Progress:** the full GitHub-style historical heatmap, with range/category filters and a clear legend.

This gives immediate context—“how am I doing this week?”—while preserving a deeper historical view for review.

#### 8. Habit/routine behavior is discoverable only inside the task modal

The current repeat controls are useful, but they appear after the day chips inside a relatively tall Add Task modal. A user who wants to build a routine has to understand that “Repeat this week” is the mechanism; there is no lightweight reminder that recurring weekly targets are the app’s habit-like model.

Recommended future copy and placement:

- Keep the existing weekly-repeat model; do not introduce a separate generic habit system without a product decision.
- Rename or annotate the section to make the intent obvious, for example **Routine / weekly target**.
- Explain the outcome in one short line: “Keep this task visible on the days you choose.”
- Preserve a fast default path so one-off task creation remains quick.

### P1 — Task interaction consistency

#### 9. Completion behavior is not fully uniform across workspaces

The dashboard uses optimistic completion with a five-second Undo toast. The week view, Career, and Content use related but visibly different completion/reopen treatments. A user should not have to learn a different completion grammar depending on where the task appears.

Standardize:

- Checkbox size, hit area, hover/pressed/focus states, and label spacing.
- Completion animation and completed-row treatment.
- Undo duration and placement. The product plan describes an approximately four-second window, while the dashboard currently uses five seconds.
- Reopen behavior and confirmation rules.
- Whether completing from a focus-area view affects the Today view immediately.

The animation should communicate state change without delaying the next task. It should be short, reversible, and disabled or simplified under reduced-motion preferences.

#### 10. The Add Task modal is clear but control-dense

The modal includes title, seven day chips, weekly repeat controls, category chips, and action buttons. It is polished, but the amount of choice makes the primary path look heavier than “write a task and continue.”

Recommended future refinements:

- Keep the title field and primary action visually dominant.
- Put the common choice first: Today, or flexible for the week.
- Progressive-disclose weekly repeat and category details when needed.
- Keep the selected-day state obvious and keyboard accessible.
- Preserve an inline quick-add path from Today for users who do not need planning metadata.

#### 11. Modal accessibility behavior needs explicit hardening

Source review of the task and confirmation dialog components did not show an obvious shared focus trap/focus-return pattern or a clearly shared Escape-key contract. These behaviors should be verified and centralized before expanding modal usage.

Acceptance criteria for every modal:

- Focus moves to the first meaningful control on open.
- Tab and Shift+Tab stay inside the dialog.
- Escape closes only when safe and expected.
- Focus returns to the trigger after close.
- Dialog title/description and error states are announced correctly.
- Mobile keyboard and viewport resizing do not hide the primary action.

### P1 — Navigation and information architecture

#### 12. This Week has too many repeated entry points in the empty state

The empty checklist view shows an Anytime panel plus seven day cards. Each day card exposes its own Add task affordance, while the page header also has Add task. This is flexible, but it creates repeated visual noise when there is no content.

Recommended future behavior:

- Keep one prominent global Add task action.
- Keep one contextual inline Add task action in the currently selected day.
- Hide or disable “Clear day” when the day has no tasks.
- Consider collapsing empty days or using a more compact week overview until a day has content.
- Retain the full seven-day view when the user has planned work, because then the visualization is useful.

#### 13. Kanban mode is clean but not the fastest default for this product promise

The empty Kanban screen has four columns—Upcoming, Doing, On Hold, Done—with large empty areas. It is visually tidy, but it introduces project-management vocabulary and scanning cost into a personal daily-planning loop.

Keep Kanban as an optional view, but make Checklist the clear default and ensure the empty Kanban state explains when it is useful. Avoid making users choose a mode before they can see their day.

#### 14. Career and Content feel detached from Today when empty

Both focus-area pages present milestones, Active, and Completed panels with large empty surfaces. The structure is consistent, but the connection back to the daily plan is not immediate.

Recommended future refinements:

- Show a compact “Next in Today” or “Planned this week” summary when the focus area has work.
- Make empty states explain the next useful action in context.
- Avoid adding more navigation layers; a direct link back to Today should be enough.

#### 15. Settings is currently a dead-end page

The live Settings page contains only a heading and a sentence saying that theme controls are in the sidebar and more settings will come later. That is honest, but it makes the route feel unfinished and gives the user no account/session or data-state reassurance.

After S4 is stable, consider showing only settings that support the active workflow:

- Account/session status and sign-out.
- Sync status and last successful sync.
- Local timezone used for day boundaries.
- Theme preference, if the sidebar control remains the primary shortcut.
- A short offline/online explanation that matches the actual architecture.

### P2 — Visual-system consistency

These are not failures visible in the current screenshots; they are consistency risks found in the source and should be addressed as a focused polish pass after S4.

#### 16. The radius scale is too broad

The stylesheet uses many radius values, including 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 46, and 999px. The large content surface treatment is distinctive, but the number of nearby values makes future components prone to drift.

Recommended semantic scale:

- `--radius-sm`: compact controls and chips.
- `--radius-md`: task rows and small panels.
- `--radius-lg`: cards, dialogs, and workspace panels.
- `--radius-xl`: the main content surface only.
- `--radius-pill`: pills and circular controls.

Map existing visuals to this scale gradually; do not flatten the approved design into generic cards.

#### 17. Motion durations are not centralized

Motion values range from roughly 150ms to 760ms, with multiple one-off transitions and animations. The current design feels calm, but without motion tokens the dashboard, week view, dialogs, and mobile shell can drift apart.

Recommended motion tokens:

- `--motion-fast`: about 160ms for hover/focus and small state changes.
- `--motion-standard`: about 220ms for panel/row transitions.
- `--motion-emphasis`: about 360ms for completion or celebratory feedback.
- One shared easing curve for standard UI movement, with a separate spring-like curve only where it adds meaning.

The existing `prefers-reduced-motion` block should cover mobile loading/spinner motion as well as web motion.

#### 18. Semantic colors are partly hard-coded

The orange palette is tokenized well, but active navigation, destructive red, rose, amber, and some status colors are also hard-coded in component styles. Introduce semantic tokens such as `--color-primary`, `--color-danger`, `--color-warning`, `--color-success`, and `--color-focus` so light/dark themes and future progress intensities stay coherent.

This is a maintainability and contrast-consistency improvement, not a request to change the approved orange palette.

#### 19. Progress intensity needs an accessible legend

If a heatmap is added, color intensity alone must not carry the meaning. Each cell needs an accessible label, a visible legend, and a non-color way to understand completion. The same applies to any completion ring or chart.

### P2 — Performance and feedback observations

#### 20. Route transitions can feel visually ambiguous while data loads

During the live walkthrough, navigation briefly showed the previous screen with the new sidebar item active before the new route content settled. This can be normal during a network/data transition, but the user may wonder whether the click worked.

Recommended future refinement:

- Use a lightweight route-level loading state or content skeleton that preserves the current shell.
- Keep the active-nav state and content transition synchronized when practical.
- Ensure loading states never look like empty states.

#### 21. Empty workspace panels use a lot of vertical space

The empty Career, Content, Progress, and Kanban views are calm but sparse. This is acceptable for a first-run state, yet repeated large empty panels can make the app feel unfinished rather than intentionally quiet.

Use compact explanatory empty states until the user has content, then expand into the richer layout when there is something to scan.

## Recommended future plan

This plan is intentionally sequenced after the current S4 phase.

### Phase A — Finish S4 and restore architectural truth

- Resolve the mobile runtime initialization error.
- Complete Supabase auth/session/realtime behavior.
- Update mobile Settings copy to match the real data model.
- Remove the mobile `prefetch` DOM warning.
- Verify timezone/day-boundary behavior and historical completion preservation.

### Phase B — Make the landing experience Today-first

- Rename the primary navigation label and page language from Dashboard to Today.
- Keep `/` as the canonical landing route; redirect `/today` to `/`.
- Put active tasks first.
- Move streak into a supporting position below or beside daily completion.
- Keep the existing compact completion metrics, but make them meaningful when the day has tasks.

### Phase C — Add daily visualization without adding friction

- Add a compact seven-day completion strip to Today.
- Highlight the selected/current day.
- Let a day selection update the compact daily summary.
- Show completed/planned, remaining, and a simple completion intensity.
- Keep the full GitHub-style historical heatmap in Progress.
- Include visible legend and accessible labels for every heatmap/intensity visualization.

### Phase D — Normalize task interaction and motion

- Create shared task-row and completion interaction primitives.
- Align checkbox hit targets, focus states, completion/reopen behavior, and Undo.
- Introduce semantic radius, motion, color, and z-index tokens.
- Apply reduced-motion behavior consistently to web and mobile.
- Add modal focus, Escape, and focus-return behavior.

### Phase E — Simplify planning and make routines obvious

- Reduce duplicate Add task affordances in empty week states.
- Keep Checklist as the default and make Kanban optional.
- Clarify “Repeat this week” as a weekly routine/target without introducing a separate generic habit system.
- Keep quick-add fast for one-off tasks.

### Phase F — Final usability pass

- Test a new user’s first task, first completion, missed task, recurring task, and progress review.
- Test keyboard navigation, screen-reader labels, reduced motion, mobile keyboard behavior, and narrow screens.
- Test with realistic task volume, not only empty states.
- Re-run responsive, mobile, dashboard, progress, and build checks.

## Suggested acceptance criteria for the future Today experience

- Opening MyPlanner immediately shows the current day, its active tasks, and the next obvious action.
- A task can be checked with one deliberate tap/click and gives immediate, reversible feedback.
- Daily progress is visible without opening Progress.
- A user can understand this week’s consistency from a compact visual without leaving Today.
- The full historical heatmap is available in Progress, with accessible labels and a legend.
- Recurring weekly work is understandable without learning a separate “habit” product.
- Task rows, dialogs, buttons, radiuses, colors, and animations feel like one system across Dashboard/Today, Week, Career, Content, Progress, Settings, and mobile.
- Empty states are calm but still tell the user what to do next.
- No future polish work is started until S4’s mobile/auth/data requirements are complete.
