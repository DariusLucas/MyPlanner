# AGENTS.md

## Product

MyPlanner is a private, local-first personal planner.

Core product loop:

Plan → Do → Complete → See Progress.

Do not add features outside that loop unless explicitly requested.

## Source of Truth

The repository uses:

- `PROJECT_PLAN.md` — full product specification and ordered phase roadmap.
- `CURRENT_PHASE.md` — the only phase currently being implemented.
- `AGENTS.md` — permanent repository rules.

For normal implementation work, prefer reading `CURRENT_PHASE.md` and the
relevant code instead of repeatedly reading the full `PROJECT_PLAN.md`.

Read `PROJECT_PLAN.md` when:

- `CURRENT_PHASE.md` does not exist,
- a new phase needs to be generated,
- requirements in `CURRENT_PHASE.md` are ambiguous,
- the user explicitly asks for product-level or roadmap changes.

## Phase Workflow

Only implement the phase described in `CURRENT_PHASE.md`.

Do not anticipate or implement later phases.

When the current phase appears complete:

1. Verify every requirement and completion criterion in `CURRENT_PHASE.md`.
2. Run all relevant:
   - tests
   - type checking
   - linting
   - migrations
   - manual verification where appropriate.
3. Fix failures before considering the phase complete.
4. Update the status of the completed phase in `PROJECT_PLAN.md` if the plan
   contains phase-status markers.
5. Read only the next phase section required from `PROJECT_PLAN.md`.
6. Replace the contents of `CURRENT_PHASE.md` with the next phase.
7. Include:
   - phase name
   - objective
   - required behavior
   - implementation checklist
   - explicit out-of-scope items
   - completion criteria
   - relevant dependencies from previous phases
8. STOP after preparing the next `CURRENT_PHASE.md`.

Do not automatically start implementing the next phase in the same task unless
the user explicitly asks you to continue.

## Important

Finishing a phase and preparing the next phase are separate from implementing
the next phase.

The correct behavior is:

Implement Phase N
→ validate Phase N
→ mark Phase N complete
→ generate CURRENT_PHASE.md for Phase N+1
→ stop

This gives the user a checkpoint between phases.

## Missing CURRENT_PHASE.md

If `CURRENT_PHASE.md` does not exist:

1. Read `PROJECT_PLAN.md`.
2. Determine the first phase that is not marked complete.
3. Create `CURRENT_PHASE.md` for that phase.
4. Do not modify unrelated code merely because the file was missing.

## Design

The existing visual design is approved.

Preserve:

- color palette
- orange accent
- sidebar design
- typography
- spacing
- border radius
- dark/light themes
- overall component language

Do not redesign existing UI unless explicitly requested.

## Engineering

- Reuse existing components before creating replacements.
- Keep architecture simple.
- Avoid unnecessary dependencies.
- Preserve SQLite data.
- Use migrations for schema changes.
- Keep historical task-completion data intact.
- Respect the configured local timezone.
- Do not silently introduce destructive database changes.
- Run relevant checks after implementation.

## Scope Discipline

Do not add speculative functionality.

Do not implement future phases early.

When a useful idea is outside the current phase, mention it in the final report
but do not implement it.
