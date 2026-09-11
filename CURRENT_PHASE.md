# Phase 2R — Product Simplification Refactor

## Status

PLANNED — C1 completed and database migrations applied successfully.

## Objective

Follow the next roadmap direction for a product simplification refactor.

## Required Behavior

- Before writing code, read the full project plan and inspect the current
  repository and database schema.
- Produce a concise refactor plan identifying what stays, changes, or is
  removed, plus migration risks.
- Implement Phase 2R only; do not start Phase 3.

## Implementation Checklist

- [ ] Read the full project plan and inspect the current implementation.
- [ ] Produce and review the Phase 2R refactor plan.
- [ ] Implement only the approved Phase 2R changes.
- [ ] Run the application and verify persistence, existing tasks, sidebar, and design preservation.
- [ ] Run typecheck, lint, tests, and relevant builds.

## Explicitly Out of Scope

- Category colors, nested categories, sharing, collaboration, permissions, and teams.
- Reordering categories by drag and drop.
- Changes to authentication providers or planner ownership.
- Any new productivity system outside Plan → Do → Complete → See Progress.

## Completion Criteria

- A nontechnical user can create, open, edit, and delete a category without
  needing to understand planner internals.
- Categories never crowd the desktop sidebar or mobile bottom bar.
- Tasks and milestones consistently follow their selected category.
- Progress can show all categories or any selected subset.
- Existing fixed-category data survives the migration.
- Relevant automated checks and production builds pass.

## Relevant Dependencies

- Existing Supabase ownership, RLS, revision, task-completion, recurrence, and
  backup behavior must remain intact.
- Phase A1 remains recorded as in progress until the user completes the
  password-recovery check; this category phase must not alter auth behavior.
