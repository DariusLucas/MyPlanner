# Phase 3B — Weekly Recurrence

## Objective

Add a simple, reliable “X times per week” recurrence workflow to This Week.

## Required Behavior

- Let users define a task recurrence by count per week without forcing
  particular weekdays.
- Generate the intended instances in Anytime This Week.
- Preserve recurrence state after reload.
- Generate exactly the intended number of new-week instances without
  duplication.
- Ensure incomplete past occurrences do not accumulate indefinitely.

## Implementation Checklist

- [ ] Design a minimal recurrence data model and create explicit migrations.
- [ ] Add recurrence creation and editing inside This Week.
- [ ] Generate recurring Anytime instances idempotently per week.
- [ ] Preserve instance state and recurrence state across reloads.
- [ ] Handle past incomplete occurrences without endless rollover.
- [ ] Test week-boundary generation and duplicate prevention thoroughly.
- [ ] Run migrations, typecheck, lint, build, and manual persistence checks.

## Explicitly Out of Scope

- Do not assign recurring tasks to forced weekdays.
- Do not build dashboard streaks, Quick Thoughts, Career, Content, or Progress
  analytics.
- Do not redesign the approved visual system.

## Completion Criteria

Phase 3B is complete only when weekly recurrence generates exactly the desired
number of Anytime instances, does not duplicate after reload or week changes,
does not let old incomplete instances accumulate, and all relevant validation
checks pass.

## Dependencies from Previous Phases

- Phase 3 — This Week + Complete Task Workflow: completed; use its persisted
  task workflow and Anytime This Week section.
