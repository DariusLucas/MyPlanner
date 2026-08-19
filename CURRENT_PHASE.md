# Phase 7 — Next-Week Planning UX

## Objective

Make planning the next week fast and natural inside This Week, preserving the
existing Plan → Do → Complete → See Progress loop without introducing a
separate planning system.

## Required Behavior

- Provide an obvious Plan next week flow inside This Week.
- Support fast inline task creation.
- Support day-by-day planning for the selected week.
- Support Anytime this week planning.
- Support quick category selection during planning.
- Preserve week navigation and past-week viewing.
- Keep normal task, recurrence, status, and completion behavior intact.
- Respect the configured local timezone and existing week-start semantics.

## Implementation Checklist

- [ ] Audit the existing This Week creation and navigation flows for reusable
      behavior.
- [ ] Add the Plan next week entry point within This Week.
- [ ] Implement fast inline creation for individual days.
- [ ] Implement fast inline creation for Anytime this week.
- [ ] Add quick category selection without expanding the form unnecessarily.
- [ ] Preserve editing, recurrence, completion, and historical week behavior.
- [ ] Add tests for week boundaries, next-week creation, Anytime tasks, category
      selection, and past-week viewing.
- [ ] Verify responsive behavior and both themes without redesigning This Week.
- [ ] Run migrations if needed, all tests, typecheck, lint, build, and rendering
      checks.

## Explicitly Out of Scope

- Do not create a separate Plan route.
- Do not implement a general calendar or scheduling system.
- Do not change task completion or recurrence semantics without a correctness
  bug.
- Do not implement Phase 8 responsive-polish work outside the planning flow.
- Do not add unrelated task fields, scoring, XP, or achievements.
- Do not redesign the approved visual system.

## Completion Criteria

Phase 7 is complete only when next-week, day-by-day, and Anytime planning are
fast and reliable inside This Week; week navigation and historical behavior are
preserved; boundary and creation tests pass; and all relevant migrations,
tests, type checking, linting, build, and rendering checks pass.

## Relevant Dependencies from Previous Phases

- Phase 3 — This Week + Complete Task Workflow: reuse the existing weekly task
  groups, creation, editing, status, completion, and navigation behavior.
- Phase 3B — Weekly Recurrence: preserve persisted weekly instances and avoid
  duplicate or prematurely generated recurrence work.
- Phase 4 — Dashboard Today System: newly planned tasks must continue to appear
  correctly in Today and overdue views.
- Phase 6/6B — Progress: planned tasks must flow into the existing historical
  cohort and visualization contract without duplicated counters.
