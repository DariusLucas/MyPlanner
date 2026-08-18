# Phase 6 — Progress Foundation

## Objective

Establish trustworthy historical progress calculations from real persisted task
data before adding visualizations, so later analytics accurately reflect the
Plan → Do → Complete → See Progress loop.

## Required Behavior

- Calculate completed task counts from persisted completion history.
- Calculate productive days.
- Calculate current and best streaks.
- Calculate completion rate from planned and completed work.
- Calculate Career, Content, and Personal category counts.
- Calculate tasks planned.
- Calculate overdue completion.
- Calculate weekday completion distribution.
- Respect the configured local timezone and preserve historical timestamps.
- Return deterministic results for empty, partial, and long-running histories.

## Implementation Checklist

- [ ] Define a focused Progress calculation contract from persisted tasks.
- [ ] Implement timezone-safe historical date normalization.
- [ ] Implement completed tasks and productive-day calculations.
- [ ] Implement current streak and best streak calculations.
- [ ] Implement planned-task and completion-rate calculations.
- [ ] Implement category-count calculations.
- [ ] Implement overdue-completion calculations.
- [ ] Implement weekday-distribution calculations.
- [ ] Add tests for empty data, boundary dates, reopened tasks, skipped tasks,
      recurring instances, and multi-month history.
- [ ] Run migrations if needed, typecheck, lint, build, and all relevant tests.

## Explicitly Out of Scope

- Do not build charts, graphs, heatmaps, summary cards, or the Progress page UI.
- Do not implement Phase 6B visualizations early.
- Do not generate fake metrics or seed fabricated history.
- Do not change task completion semantics or delete historical task data.
- Do not add XP, levels, generic achievements, or unrelated analytics.
- Do not redesign the approved visual system.

## Completion Criteria

Phase 6 is complete only when every required progress metric is calculated from
real persisted history; timezone, status, recurrence, and empty-data edge cases
are covered by passing tests; historical task data remains intact; and all
relevant validation checks pass.

## Relevant Dependencies from Previous Phases

- Phase 3 — This Week + Complete Task Workflow: use persisted task workflow
  statuses, planned dates, categories, and completion timestamps.
- Phase 3B — Weekly Recurrence: count persisted recurring instances without
  duplicating recurrence definitions or treating skipped instances as complete.
- Phase 4 — Dashboard Today System: reuse the proven local-date and streak
  semantics where they match the broader historical contract.
- Phase 5 — Career + Content: category history is now exposed consistently;
  Career and Content milestones remain outcomes and must not count as task
  completions.
