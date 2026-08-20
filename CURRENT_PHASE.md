# Phase 9 — Backup + Stability

## Objective

Protect the planner’s growing local history with reliable manual JSON export
and import, validating every backup before any persisted data is changed.

## Required Behavior

- Export the complete restorable planner dataset to a local JSON file.
- Include an explicit backup format version and enough metadata to validate and
  restore the data safely.
- Import a selected JSON backup only after validating its structure, values,
  relationships, and supported version.
- Reject malformed, incomplete, incompatible, or internally inconsistent
  backups without modifying the current database.
- Make any accepted restore atomic so a failure cannot leave partially imported
  data behind.
- Clearly tell the user when an import will replace existing local data and
  require confirmation before doing so.
- Preserve tasks, recurrence, completion history, progress history, milestones,
  Quick Thoughts, settings, and all relational links through a round trip.

## Implementation Checklist

- [ ] Audit every persisted table and relationship required for a complete
      restore.
- [ ] Define a versioned JSON backup contract and strict validation schema.
- [ ] Implement local JSON export from the existing Settings surface.
- [ ] Implement local JSON file selection and validation for import.
- [ ] Present import validation errors without changing existing data.
- [ ] Add an explicit confirmation step before replacing local planner data.
- [ ] Restore validated data in a single transaction with foreign-key-safe
      ordering and rollback on failure.
- [ ] Revalidate all affected routes after a successful restore.
- [ ] Add tests for round trips, malformed input, unsupported versions, missing
      relationships, rollback, and preservation of historical data.
- [ ] Verify the backup controls at responsive sizes and in both themes without
      redesigning Settings.
- [ ] Run migrations if needed, all tests, typecheck, lint, build, and manual
      export/import verification.

## Explicitly Out of Scope

- Do not add cloud sync or third-party storage integrations.
- Do not add scheduled or automatic backups.
- Do not implement partial-table imports or merge conflict resolution.
- Do not silently overwrite the current database.
- Do not accept malformed or unsupported backup formats on a best-effort basis.
- Do not implement Phase 10’s full application stabilization audit early.
- Do not redesign the approved visual system.

## Completion Criteria

Phase 9 is complete only when a versioned JSON export contains all restorable
planner data; a valid backup can be restored atomically with relationships and
history intact; malformed, incompatible, or inconsistent imports leave the
existing database untouched; replacement requires explicit confirmation; the
Settings controls work responsively in both themes; and all migrations, tests,
type checking, linting, build, and manual round-trip checks pass.

## Relevant Dependencies from Previous Phases

- Existing SQLite migrations and schema are the source of truth for every table
  and relationship included in a backup.
- Phase 3/3B — Tasks, completion history, and recurrence instances must retain
  their identifiers and relationships.
- Phase 4/5 — Daily focus, Quick Thoughts, focus-area tasks, and milestones must
  survive round trips.
- Phase 6/6B — Historical completion timestamps and progress inputs must remain
  unchanged so analytics reproduce the same results.
- Phase 8 — Backup controls and confirmation states must preserve the responsive
  shell, touch targets, themes, and approved visual language.
