# Phase S5 — Import, Verification, and Production Cutover

## Objective

Safely import the existing desktop SQLite planner data into Supabase, prove
that the imported development data matches the source, and then execute the
documented production cutover with verified rollback artifacts.

## Required Behavior

- Create a SQLite-consistent migration snapshot while preserving WAL state.
- Validate snapshot integrity, foreign keys, row counts, relationships, and
  the canonical `Europe/Bucharest` planner timezone before import.
- Import the desktop data into the development Supabase project using a
  server-only transactional importer and explicit legacy-to-new ID maps.
- Preserve source timestamps, nullable values, statuses, task positions,
  recurrence definitions, completion history, and relationships.
- Reject invalid enum values, orphaned foreign keys, and unsupported records
  before target rows are committed.
- Produce a non-secret import report containing source/target counts, rejected
  rows, timezone, and validation checks.
- Verify imported data through normal authenticated RLS clients, including
  isolation from a second test user.
- Verify Dashboard, Today, This Week, Career, Content, and Progress outputs
  against expected data derived from the SQLite snapshot.
- Test web and Android against the same imported development user, including
  Realtime refresh, session restoration, network errors, and stale writes.
- Create or configure the distinct production Supabase project, apply reviewed
  migrations, import the final verified snapshot exactly once, and perform
  bidirectional web/Android spot checks before release.
- Keep the final SQLite snapshot and import report available for rollback.

## Implementation Checklist

- [ ] Inspect the current SQLite schema, migrations, live database, and WAL
      handling requirements.
- [ ] Build an immutable SQLite snapshot command with integrity and row-count
      validation.
- [ ] Build the server-only SQLite-to-Supabase importer with protected user
      configuration and transactional rollback.
- [ ] Build the independent Supabase import verifier and expected-data report.
- [ ] Run repeated imports against development data and fix all discrepancies.
- [ ] Verify development RLS access, second-user isolation, relationships,
      counts, timestamps, recurrence, dashboard, and progress parity.
- [ ] Run manual web/Android development spot checks using the imported data.
- [ ] Prepare the documented write freeze, production project, migration,
      import, release, and rollback steps.
- [ ] Execute production cutover only after every development gate passes.
- [ ] Run production verification, bidirectional cross-device testing, and
      preserve rollback artifacts.
- [ ] Update migration, Android, Supabase, and operational documentation.

## Explicitly Out of Scope

- Do not implement the Supabase JSON backup/export/import product feature; that
  is Phase S6.
- Do not delete `data/planner.db`, SQLite migrations, snapshots, or legacy code
  during this phase without explicit approval after successful cloud operation.
- Do not perform an ad-hoc reverse conversion from Supabase to SQLite.
- Do not add sharing, teams, push notifications, analytics, or speculative
  planner features.
- Do not alter the approved visual design or planner interaction language.

## Completion Criteria

Phase S5 is complete only when the desktop SQLite snapshot has been imported
without loss of relationships or completion history; source and target counts,
values, timestamps, dashboard outputs, and progress outputs have been verified;
RLS ownership isolation passes; repeated development imports are reliable; web
and Android pass manual cross-device checks; production migrations and the
final import succeed under the documented freeze; production verification and
rollback artifacts are preserved; and both clients operate against the
production Supabase project.

## Relevant Dependencies from Previous Phases

- S2 provides the applied PostgreSQL schema, Auth, RLS policies, planner RPCs,
  recurrence behavior, and migration history.
- S3 provides the authenticated web Supabase client and planner parity
  contracts.
- S4 provides the authenticated Android Supabase client, Keystore-backed
  sessions, Realtime invalidation, and verified shared development behavior.
- `SUPABASE_MIGRATION_PLAN.md` defines the import ordering, validation gates,
  production freeze, and rollback requirements.
- The canonical planner timezone is `Europe/Bucharest`.
