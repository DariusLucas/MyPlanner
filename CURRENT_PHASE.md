# Phase 2R — Product Simplification Refactor

## Objective

Remove complexity introduced by the old plan while preserving the working
infrastructure, existing task persistence, reusable components, application
shell, global styling, and approved visual design.

## Required Behavior

- Inspect the repository and identify old-plan concepts and placeholder UI.
- Preserve existing task CRUD and persistence.
- Simplify routes, Dashboard, and sidebar.
- Remove or deactivate unnecessary pages and obsolete placeholder content.
- The sidebar must contain only:
  - Dashboard
  - This Week
  - Career
  - Content
  - Progress
  - Settings
- Preserve the existing color palette, orange accent, typography, spacing,
  border radius, themes, sidebar language, and reusable component patterns.

## Database Audit

Before changing schema:

1. Inspect the current Drizzle schema.
2. List existing tables.
3. Determine which tables still serve the new product direction.
4. Determine whether data migration is needed.
5. Preserve existing user tasks where practical.
6. Create explicit migrations for schema changes.

Do not casually delete the local SQLite database. If destructive changes are
genuinely required, explain why and back up or migrate useful existing data
before modifying the schema.

## Implementation Checklist

- [ ] Inspect the full repository and current implementation.
- [ ] Identify old-plan concepts, placeholder content, obsolete routes, and
      unnecessary schema.
- [ ] Simplify the application structure within this phase's scope.
- [ ] Update navigation to the approved Phase 2R destinations.
- [ ] Remove obsolete placeholder content from the Dashboard.
- [ ] Audit and migrate the database safely if required.
- [ ] Preserve existing tasks and task behavior.
- [ ] Run the application and verify it starts normally.
- [ ] Run migrations, typecheck, lint, and relevant tests.
- [ ] Manually verify persistence, existing tasks, sidebar, and approved design.

## Explicitly Out of Scope

- Do not implement the entire new product plan.
- Do not implement Phase 3 or any later phase.
- Do not add speculative functionality.
- Do not redesign the approved visual system.
- Do not casually delete the local SQLite database or historical task data.

## Completion Criteria

Phase 2R is complete only when:

- the application starts normally;
- the approved visual design remains intact;
- the sidebar contains only the desired destinations;
- obsolete placeholder content is removed;
- the Dashboard is no longer cluttered by old future-system placeholders;
- existing tasks still work;
- database migrations succeed;
- typecheck passes;
- lint passes; and
- existing relevant tests pass.

After validating Phase 2R, update the roadmap status if applicable, prepare
`CURRENT_PHASE.md` for the next incomplete phase, and stop. Do not implement
the next phase automatically.

## Dependencies from Previous Phases

- Phase 1 — Foundation: completed.
- Phase 2 — Task System: completed/current infrastructure to preserve.
