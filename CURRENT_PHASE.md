# Phase C1 Follow-up — Category Management

## Status

COMPLETED — local migration and category-deletion behavior verified.

The original product-simplification Phase 2R is already marked COMPLETED in
`PROJECT_PLAN.md`. This phase file was carrying the category-management scope
from Phase C1 under that reused label; Phase C1 is also marked COMPLETED.

## Objective

Close the remaining category-deletion safety gap while preserving the completed
user-defined category behavior and its historical data.

## Required Behavior

- Before writing code, read the full project plan and inspect the current
  repository and database schema.
- Produce a concise refactor plan identifying what stays, changes, or is
  removed, plus migration risks.
- Implement Phase 2R only; do not start Phase 3.

## Implementation Checklist

- [x] Read the full project plan and inspect the current implementation and schema.
- [x] Produce and review the Phase 2R refactor plan.
- [x] Implement only the approved Phase 2R changes.
- [x] Apply the new migration locally and verify category persistence guards, category navigation, and design preservation through the database checks and production builds.
- [x] Run typecheck, lint, relevant tests, and web/mobile production builds.

The local database linter still reports an existing error in the older
`import_planner_backup` function; the new category migration applies successfully
and introduces no reported lint issue. No hosted project was linked or changed.

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
- Phase A1 is limited to Google sign-in on web and Android. Account recovery,
  email/password sign-in, and provider dashboard checks are out of scope.
