# Phase 4 — Dashboard Today System

## Objective

Refactor the Dashboard around one unified Today system that makes active work,
overdue work, completion, and daily momentum visible at a glance.

## Required Behavior

- Show today's active tasks.
- Carry overdue incomplete tasks into Today.
- Show tasks completed today.
- Show completed and remaining counts.
- Allow task completion directly from the Dashboard.
- Preserve the approximately four-second completion undo window.
- Show a daily streak with a restrained visual temperature/state.
- Support a Quick Thought capture flow.
- Show latest thoughts and provide View All thoughts.
- Allow thoughts to be edited and deleted.
- Keep the Dashboard focused; do not fill remaining space with filler.

## Implementation Checklist

- [ ] Define the Dashboard Today data contract using persisted task history.
- [ ] Build the active, overdue, completed-today, and count sections.
- [ ] Reuse the existing task completion and undo behavior.
- [ ] Add daily streak calculation and visual state.
- [ ] Add Quick Thought creation, listing, editing, and deletion.
- [ ] Preserve the approved visual system and responsive layout.
- [ ] Test timezone boundaries, completion persistence, undo, and thought CRUD.
- [ ] Run migrations if needed, typecheck, lint, build, and manual checks.

## Explicitly Out of Scope

- Do not implement Career or Content management systems.
- Do not build Progress analytics or heatmaps.
- Do not redesign the approved visual system.
- Do not add filler dashboard widgets unrelated to Plan → Do → Complete → See Progress.

## Completion Criteria

Phase 4 is complete only when the Dashboard accurately shows active, overdue,
completed-today, and remaining work; completion and undo persist reliably;
streak state respects the configured local timezone; Quick Thoughts support the
required CRUD flow; and all relevant validation checks pass.

## Dependencies from Previous Phases

- Phase 3 — This Week + Complete Task Workflow: completed; reuse persisted task
  statuses, completion timestamps, and the completion undo behavior.
- Phase 3B — Weekly Recurrence: completed; recurring task instances and skipped
  missed occurrences must remain compatible with Dashboard active/overdue views.
