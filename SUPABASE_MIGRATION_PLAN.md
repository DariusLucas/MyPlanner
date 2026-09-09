# Supabase Migration Plan

## Status

**User-approved architecture direction — 2026-08-20.**

**Foundation workflow amendment — 2026-08-22:** the user approved using the
empty remote Supabase project as development and not installing Docker/WSL.
Committed migrations must be applied and verified against that development
project. A distinct production project is still required before cutover.

**Fresh-cloud-start amendment — 2026-09-02:** the user confirmed that the
existing SQLite records are disposable development data. The SQLite snapshot,
SQLite-to-Supabase importer, import verifier, and data rollback artifacts are
not required. Phase S5 now starts with an empty Supabase dataset and validates
fresh records created through the authenticated clients. The detailed import
procedure below is retained as historical reference only and is not an active
requirement.

This document is the implementation reference for replacing the planner's
separate desktop and Android SQLite databases with one Supabase-backed planner.
It does not itself change the active phase. Before implementation begins,
update `project_plan.md` and replace `CURRENT_PHASE.md` with a dedicated
Supabase migration phase. The existing plan's local-first/no-auth constraints
are intentionally superseded by that approved roadmap change.

## Decision Summary

| Topic | Decision |
| --- | --- |
| Canonical data store | Supabase PostgreSQL is the only writable planner database. |
| Platforms | The Next.js web app and Capacitor Android app use the same data. |
| Mobile connectivity | Online-first. No offline editing or local write queue in this migration. |
| Initial account scope | One private planner per user; same user signs in on web and Android. |
| Initial authentication | Minimal passwordless email one-time-code sign-in. No profiles UI yet. |
| Existing data | Do not import SQLite data; start with an empty Supabase dataset. |
| Profiles/future auth | Deferred, but the schema uses `auth.users` UUIDs from the first migration so profiles can be added without moving planner data. |
| Backup phase | Removed from active product scope after cutover; deployed migration history is retained without client exposure. |
| Cloud sync | Both clients write the same cloud database. Realtime provides prompt refreshes, not a second source of truth. |

## Why Phase 9 Follows the Migration

Phase 9 is currently specified around local SQLite export/import, local
transactions, and independent local databases. Supabase is now a confirmed,
near-term replacement, so implementing that feature first would require a
second backup/import implementation after the persistence change.

The required order is:

1. Create and validate a one-off immutable SQLite snapshot for migration
   safety.
2. Implement and cut over to Supabase.
3. Verify imported data and both clients.
4. Implement Phase 9 as **per-user Supabase JSON export/import**.
5. Run the broader stabilization phase.

The one-off snapshot in step 1 is not the Phase 9 product feature. It is a
non-negotiable rollback artifact used only to protect the existing data during
cutover.

## Scope

### In scope

- Supabase project setup, local development workflow, migrations, and
  environments.
- PostgreSQL versions of all current planner tables and relationships.
- Minimal account identity required to share one private planner across web and
  Android.
- Row Level Security (RLS) on every planner table.
- Web and Android data-access migration to the shared database.
- Atomic database functions for multi-row planner behavior.
- Desktop SQLite data import, validation, cutover, and rollback plan.
- Cross-device refresh and concurrency handling.
- Preparation for a later `profiles` table and richer authentication UX.

### Explicitly out of scope

- Offline mobile edits, local SQLite cache, outbox queues, or conflict UI.
- Shared planners, organisations, family/team access, invitations, or roles.
- Public profile pages, avatars, display names, social graphs, or analytics.
- OAuth providers, passkeys, password sign-in, and account merging.
- Push notifications, file storage, telemetry, or third-party analytics.
- Implementing Phase 9 before the Supabase cutover.

## Required Product Behavior After Cutover

- A user signs in with the same email on web and Android.
- Both platforms display and mutate the same planner records.
- A successful mutation is committed by PostgreSQL before either UI reports
  success.
- A mutation made on one open platform appears on the other promptly; every
  screen also re-fetches when the app becomes active so missed Realtime events
  cannot leave stale data visible.
- If the Android device has no network, it clearly reports that planner data
  cannot be loaded or changed. It must not pretend a change was saved locally.
- One user can never read or mutate another user's planner through the client
  API.
- Timezone-sensitive progress calculations use the single planner timezone,
  not whichever timezone happens to be reported by the device.

## Architecture

```text
Next.js web app ─── Supabase browser/server clients ──┐
                                                       │
Capacitor Android ─ Supabase JavaScript client ────────┼── Supabase Auth
                                                       ├── Supabase Data API
                                                       ├── PostgreSQL + RPCs
                                                       └── Realtime invalidation
```

### Non-negotiable security rules

- Mobile and browser code use only the Supabase URL and publishable key.
- `service_role` keys, database passwords, and direct database connection
  strings never appear in browser bundles, Android assets, git, logs, or error
  messages.
- The mobile app communicates through Supabase's authenticated Data API/RPC,
  not a raw PostgreSQL connection.
- All user data tables have RLS enabled before they are exposed to a client.
- The migration/import script runs only locally or in a protected CI job with
  privileged credentials; it is never bundled into either app.

## Authentication: Minimal Now, Profiles Later

Authentication and profiles are separate concerns.

The migration must add secure identity now because web and Android require a
stable common `auth.uid()` to access the same private planner. It does **not**
need a public profile feature.

### Initial authentication implementation

- Enable passwordless email one-time-code sign-in in Supabase Auth.
- Provide a small sign-in screen in web and Android: enter email, enter code,
  sign out.
- Use the same verified email on both platforms.
- Persist the authenticated session:
  - Web: cookie-based Next.js SSR client.
  - Android: a Capacitor-compatible secure storage adapter backed by the
    Android Keystore; select and review the storage plugin during
    implementation.
- Redirect unauthenticated users to sign-in before loading planner routes.
- Revalidate the session server-side before privileged server actions.
- Do not create a `profiles` table in this phase.

Email code is preferred to magic links for the initial Android build because it
does not require deep-link handling. A magic-link flow can be added later.

### Why anonymous sign-in is not the primary plan

Anonymous Auth can secure data within one installation, but the desktop and
Android installations would receive different anonymous users. Pairing them
would require extra account-linking/pairing infrastructure and provides weak
recovery if a session is lost. It is unnecessary when the goal is a private
planner accessible from two of the user's devices.

### Preparation for future profiles and richer Auth

All planner ownership uses `user_id uuid references auth.users(id)`, never an
email or a profile-table identifier. A later phase can add:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

The future `profiles.id` is the same value as `auth.users.id`; no planner-row
migration will be required. Account linking or signing in to an existing
account must retain the existing `auth.users.id`; do not attempt to merge two
planner accounts automatically.

## PostgreSQL Schema Design

### General conventions

- Use `uuid` primary keys with `gen_random_uuid()` defaults.
- Use `timestamptz` for instants: `created_at`, `updated_at`, and
  `completed_at`.
- Use `date` for calendar dates: task dates, week starts, and sprint dates.
- Use `boolean` instead of SQLite integer booleans.
- Use `check` constraints for the existing category, priority, task-status,
  goal-status, sprint-status, and milestone-type values. PostgreSQL enums are
  deliberately avoided initially because check constraints are easier to
  evolve in migrations.
- Add a shared `set_updated_at()` trigger to modify `updated_at` on every
  update.
- Add `revision bigint not null default 1` to mutable records. Database
  functions increment it, allowing stale-write detection.
- Preserve current `created_at`, `updated_at`, and `completed_at` values during
  import. Never rewrite historical completion instants to import time.
- Store `position` as an integer initially, but only calculate/reorder it in
  atomic database functions. Never calculate `max(position) + 1` independently
  on both clients.

### Ownership and user-bound uniqueness

Every user-owned table has:

```text
id uuid primary key
user_id uuid not null references auth.users(id) on delete cascade
```

`app_settings` is the exception: `user_id` is its primary key because there is
exactly one settings row per user.

All relevant unique indexes include `user_id`:

- `daily_focus (user_id, date)`
- `sprint_weeks (user_id, sprint_id, week_number)`
- `tasks (user_id, recurrence_id, recurrence_week_start, recurrence_index)`

Child-table ownership must match parent-table ownership. Enforce this with
composite foreign keys where practical and with write RPCs for all complex
writes. A user must never be able to attach one of their tasks to another
user's goal, sprint, week, or recurrence.

### Table mapping

| Current SQLite table | Supabase PostgreSQL table and required changes |
| --- | --- |
| `app_settings` | Primary key becomes `user_id`; retain current settings; add `timezone text not null` containing an IANA timezone. |
| `goals` | UUID `id`, `user_id`, typed dates/timestamps, status/category checks, revision. |
| `sprints` | UUID `id`, `user_id`, typed dates/timestamps, status check, revision. |
| `sprint_weeks` | UUID `id`, `user_id`, user-matched sprint reference, per-user sprint/week uniqueness, revision. |
| `weekly_targets` | UUID `id`, `user_id`, user-matched sprint-week reference, revision. |
| `daily_focus` | UUID `id`, `user_id`, `date`, unique `(user_id, date)`, revision. |
| `task_recurrences` | UUID `id`, `user_id`, boolean `active`, typed dates/timestamps, revision. |
| `tasks` | UUID `id`, `user_id`, UUID parent references, typed dates/timestamps, recurrence uniqueness, revision. |
| `content_milestones` | UUID `id`, `user_id`, typed timestamp, checks, revision. |
| `quick_thoughts` | UUID `id`, `user_id`, timestamps, revision. |
| New: `task_events` | Immutable, append-only task history for completion/reopen/skip events. |

### Timezone decision

The import must set one canonical IANA timezone in `app_settings.timezone`.
The current workspace timezone is `Europe/Bucharest`; use it only after the
user confirms it at import time. All progress, streak, “today,” and weekly
boundary calculations use this stored value, including on Android while the
device is travelling.

### Task events

Create `task_events` with at least:

```text
id uuid primary key
user_id uuid not null references auth.users(id) on delete cascade
task_id uuid not null references tasks(id) on delete cascade
kind text not null check (kind in ('completed', 'reopened', 'skipped', 'restored'))
occurred_at timestamptz not null
created_at timestamptz not null default now()
```

The current `tasks` row remains the current state. `task_events` is the durable
audit/history record used to protect progress history from accidental
overwrites. During import, create a `completed` event only when a source task
has a real `completed_at`; do not invent timestamps for historic skipped tasks.

## RLS and Database Access

### RLS baseline

Enable RLS on every `public` planner table. The base policy pattern is:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

Use specific `select`, `insert`, `update`, and `delete` policies rather than a
single broad policy. `task_events` receives no client-side update or delete
policy; events are inserted only by controlled database functions.

Database functions that modify planner rows must use the caller's
`auth.uid()`, validate ownership, and never trust a client-supplied `user_id`.
Grant execute only to the `authenticated` role. Review whether each function
needs `security invoker` (preferred) or tightly constrained `security definer`.

### Client access rules

- Simple reads may use the Data API directly with RLS.
- Simple thought/milestone operations may use direct RLS-protected operations
  only if they use optimistic revision checks.
- All cross-row operations use RPCs.
- Server actions use the user's Supabase session, not a service-role client.
- A service-role client exists only in server-only data-import/administration
  code and is never required for normal planner behavior.

## Atomic Planner Functions

Implement SQL functions/RPCs with input validation, ownership checks,
idempotent behavior, and transactional all-or-nothing updates.

Required functions:

- `create_task(input, client_task_id)`
- `update_task(task_id, expected_revision, input)`
- `move_task_to_tomorrow(task_id, expected_revision)`
- `reorder_task(task_id, expected_revision, direction)`
- `set_task_workflow(task_id, expected_revision, status)`
- `complete_task(task_id, expected_revision)`
- `reopen_task(task_id, expected_revision)`
- `delete_task(task_id, expected_revision)`
- `save_daily_focus(date, career_mission, content_mission, expected_revision)`
- `create_or_update_recurrence(...)`
- `ensure_recurring_instances(week_start)`
- `delete_or_deactivate_recurrence(recurrence_id, expected_revision)`

Function requirements:

- Reject an update when `expected_revision` does not match the stored revision.
- Return the authoritative changed records, new revision, and a typed stale
  conflict result when appropriate.
- Treat retry-safe requests idempotently. Creating a task with the same UUID,
  completing an already completed task, deleting an already deleted task, and
  generating an existing recurrence instance must not duplicate history.
- Write recurrence instances with `insert ... on conflict ... do nothing`.
- Perform all position changes in the same transaction as the target mutation.
- Completion inserts exactly one event for a state transition; a retry must not
  insert another completed event.
- Preserve current behavior: deleting/deactivating a recurrence must not erase
  completed or skipped historical instances.

## Realtime and Concurrency

Realtime is an invalidation/refresh signal, not a database replica and not a
replacement for a fresh query after reconnect.

### Required client behavior

- Subscribe to changes for the authenticated user's planner tables while a
  screen is active.
- On a relevant event, invalidate the affected screen data and re-fetch the
  authoritative rows; do not patch complex UI state solely from an event
  payload.
- Re-fetch on web focus, Android app resume, route change, auth refresh, and
  Realtime reconnection.
- Unsubscribe on sign-out and user change.
- Treat missed events as normal: a standard fresh query must repair the UI.

### Concurrent edit rules

| Situation | Required behavior |
| --- | --- |
| Same task edited on both platforms | First accepted update wins; stale revision returns a conflict, UI re-fetches and asks the user to retry. |
| Completion/reopen retry after poor network | RPC is idempotent; state and event history are not duplicated. |
| Two position changes | Server transaction serializes the reorder and returns authoritative order. |
| Recurrence opened on both platforms | Unique constraint and idempotent function prevent duplicate instances. |
| Remote deletion while a form is open | Save returns “no longer exists”; UI refreshes with a clear message. |
| Network fails before response | UI reports an unsaved change; re-fetch before retrying. Never assume the operation failed or succeeded solely from the transport error. |

Because this is online-first, the initial UX does not need an offline queue or
merge screen. If offline writes are ever added, create a separate sync design
phase; do not add them opportunistically.

## Code and Dependency Migration

### New project structure

Add a Supabase layer shared where practical by desktop and mobile:

```text
supabase/
  config.toml
  migrations/
src/lib/supabase/
  database.types.ts
  browser.ts
  server.ts
  middleware.ts
  planner-repository.ts
  planner-errors.ts
scripts/
  import-sqlite-to-supabase.ts
  verify-supabase-import.ts
```

The exact filenames may evolve, but database access must have one clear
boundary. UI components must not contain SQL or Supabase table names.

### Dependencies and tooling

- Add `@supabase/supabase-js`.
- Add `@supabase/ssr` for Next.js cookie/session handling.
- Add the Supabase CLI as a development dependency or use a documented pinned
  CLI workflow.
- Add a server-only PostgreSQL client such as `pg` for the one-time importer
  and verification scripts, if direct transactional import is selected.
- Add and review a Capacitor secure-storage solution before persisting Android
  refresh tokens.
- Generate `database.types.ts` from the committed Supabase schema; do not
  hand-maintain duplicate database types.

### Web replacement targets

Replace the SQLite dependency chain in:

- `src/db/client.ts`
- `src/db/schema.ts`
- `src/db/migrations/`
- `drizzle.config.ts`
- `src/app/today/actions.ts`
- `src/app/dashboard-actions.ts`
- `src/app/content-actions.ts`
- data-query modules in `src/lib/`

Retire `better-sqlite3` and SQLite Drizzle dependencies only after the cloud
cutover, import verification, and all tests pass. Preserve the old migration
history in git; do not rewrite it.

### Android replacement targets

Replace the local database/action path in:

- `mobile/src/database.ts`
- `mobile/src/data.ts`
- `mobile/src/actions/tasks.ts`
- `mobile/src/actions/milestones.ts`
- `mobile/src/actions/thoughts.ts`
- offline-only copy in `mobile/src/mobile-app.tsx`
- `ANDROID.md`

The Android app must show authentication and online-state UI rather than
claiming that data is stored only on-device or available without internet.

## Environment Configuration

Use development and production Supabase projects. Never test destructive data
imports against production first.

### Required variables

Web server/client:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY            # server-only; importer/admin only
SUPABASE_DB_URL                      # server-only; importer/migrations only
```

Mobile build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

The `NEXT_PUBLIC_` and `VITE_` values are safe to ship. The service-role and
database values are not.

## Desktop Data Migration

### Preconditions

1. Stop the desktop application and any development server that can write to
   `data/planner.db`.
2. Create a SQLite-consistent snapshot using SQLite's backup mechanism; include
   the WAL state correctly rather than copying only the main file while it is
   live.
3. Run `PRAGMA integrity_check` and foreign-key validation against the
   snapshot.
4. Record row counts for every source table.
5. Create a user in the target Supabase development project and record only
   its UUID in protected import configuration.
6. Confirm the canonical planner timezone before import.

### Import algorithm

The importer is a server-only script. It reads the SQLite snapshot, generates
new UUIDs, holds legacy-to-new ID maps in memory, and writes the transformed
records to PostgreSQL in one controlled transaction where practical.

Import in this order:

1. `app_settings` -> per-user settings row, including confirmed timezone.
2. `goals`.
3. `sprints`.
4. `task_recurrences`.
5. `sprint_weeks` using the sprint ID map.
6. `weekly_targets` using the sprint-week ID map.
7. `daily_focus`.
8. `tasks` using goal/sprint/week/recurrence ID maps.
9. `content_milestones`.
10. `quick_thoughts`.
11. Backfill `task_events` only for tasks with a real `completed_at` value.

The importer must:

- Set `user_id` to the selected authenticated user for every imported row.
- Preserve all nullable values and statuses exactly.
- Preserve source timestamps and task positions.
- Reject orphaned foreign keys and unsupported enum values before any target
  rows are committed.
- Roll back all target writes if validation or insert fails.
- Produce a non-secret report with source/target counts, rejected rows,
  timezone, and checks performed.

### Validation after import

Run a separate verifier that proves:

- Equal row counts for every migrated source table.
- All current foreign keys resolve.
- All current unique relationships resolve.
- Settings, tasks, thoughts, milestones, focus values, recurrence definitions,
  and recurrence instances have expected values.
- Task completion count and completion timestamps match source data.
- Dashboard, Today, Week, focus-area, and Progress outputs match a saved
  expected-data report from the SQLite snapshot.
- The target user can access data through normal RLS clients.
- A second test user cannot access any imported rows.

No production cutover occurs until every validation succeeds.

## Deployment and Cutover

### Development acceptance

1. Apply all migrations to local Supabase and a remote development project.
2. Run the importer on a copy of desktop data.
3. Complete all automated and manual validations.
4. Test web and Android against the same development user.
5. Verify Realtime refresh, session restoration, network errors, and stale
   write handling.

### Production cutover

1. Announce a short local write freeze to the planner user.
2. Stop the local app and take a final verified SQLite snapshot.
3. Create or sign in to the production account.
4. Apply reviewed production migrations.
5. Import the final snapshot exactly once.
6. Run the production verifier and manual spot checks.
7. Release the cloud-backed web build.
8. Build/install the cloud-backed Android app.
9. Verify bidirectional changes using the same account.
10. Keep the final SQLite snapshot and import report as historical rollback
    artifacts.

### Rollback

- Before production release: discard the development target and fix migrations;
  source SQLite remains untouched.
- During import failure: roll back the import transaction; source SQLite
  remains untouched.
- After web release but before confidence: restore the previous web build and
  keep the SQLite snapshot as the historical source.
- Never attempt an ad-hoc reverse conversion from Supabase to SQLite during an
  incident. Use the verified snapshot or a deliberate export/import procedure.
- Do not delete `data/planner.db`, its snapshot, or old code until the user
  explicitly approves retirement after successful cloud operation.

## Phase 9 After Cutover

Phase 9 becomes a Supabase-aware backup feature, not a local SQLite feature.

Required behavior:

- Export only the authenticated user's complete planner dataset as versioned
  JSON.
- Include the schema/backup version, user-independent metadata, timezone,
  and all relational UUIDs.
- Validate data, relationships, supported version, and ownership before
  import.
- Import through a server-side/RPC transaction that can replace **only that
  user's** planner data after explicit confirmation.
- Never allow one user to import into another user's rows.
- Preserve historical task events and task completion timestamps.
- Re-fetch/invalidate all open web/mobile planner views after a successful
  restore.

## Required Tests

### Security

- Unauthenticated requests receive no planner data.
- User A cannot select, insert, update, delete, or invoke an RPC against User
  B's rows.
- A client cannot choose an arbitrary `user_id` in a write payload.
- Service-role credentials are absent from web and Android output bundles.

### Data integrity and behavior

- Every existing SQLite migration relationship imports correctly.
- Reopening/closing an app preserves authentication session appropriately.
- Same-account web and Android views show the same current task data.
- Task create, edit, move, reorder, workflow change, completion, undo/reopen,
  recurrence update, recurrence deletion, focus save, milestone CRUD, and
  thought CRUD work from both platforms.
- Recurrences create exactly the expected instances when both platforms open
  the same week.
- Completed/skipped recurrence history remains intact.
- Task completion creates one event and one current state transition.
- Progress/streak calculations use the stored planner timezone.
- Network failure never produces a false successful UI state.
- Stale revision returns a recoverable conflict and does not overwrite a newer
  change.
- Realtime reconnection plus re-fetch repairs stale UI.

### Validation commands and manual checks

Run all relevant project checks after each migration phase:

```text
npm run typecheck
npm run lint
npm run build
npm run test:recurrence
npm run test:dashboard
npm run test:focus-areas
npm run test:progress
npm run test:week-planning
npm run test:responsive
npm run test:mobile
```

Add Supabase migration reset/apply, RLS integration, importer, and cross-client
end-to-end checks to this list as part of the implementation.

## Implementation Phases and Gates

### Phase S1 — Roadmap amendment and Supabase foundation

- Update `project_plan.md` to add the approved cloud migration before Phase 9.
- Generate a Supabase-specific `CURRENT_PHASE.md`.
- Initialise the Supabase CLI, protected environment, remote development
  project, and production-project boundary.
- Add protected environment variable templates and secret handling guidance.

**Gate:** the remote development project can apply committed migrations and no
secrets are committed.

### Phase S2 — Schema, Auth, RLS, and database functions

- Create PostgreSQL schema, indexes, checks, timestamps, revisions, RLS, and
  RPCs.
- Implement minimal email-code authentication.
- Generate TypeScript database types.
- Add RLS/function integration tests.

**Gate:** authenticated test users are isolated, and all mutation functions are
atomic/idempotent.

### Phase S3 — Web migration

- Replace SQLite reads/writes with authenticated Supabase clients and RPCs.
- Add web sign-in/session handling and refresh behavior.
- Preserve current UI/data contracts and visual design.

**Gate:** the complete web planner works against development Supabase with no
SQLite runtime dependency.

### Phase S4 — Android migration

- Replace Android SQLite data/actions with Supabase client access.
- Add sign-in/session secure storage, loading/error/network states, and
  Realtime invalidation.
- Update Android documentation and mobile Settings copy.

**Gate:** the Android build and web build visibly share one development
planner, including changes initiated from either platform.

### Phase S5 — Import, verification, and production cutover

- Build snapshot, import, and verification scripts.
- Test import repeatedly against development data.
- Execute production cutover using the documented freeze and rollback steps.

**Gate:** import report, automatic verification, manual spot checks, and
cross-device production test all pass.

### Phase S6 — Supabase stabilization

- The previously implemented backup RPC migration remains recorded in deployed
  schema history but is intentionally not exposed by web or Android clients.
- Complete the stabilization audit and update active client documentation.

## Decisions Required at Implementation Start

These do not block preserving this plan, but must be recorded before Phase S1
is marked complete:

1. Confirm the initial canonical planner timezone (workspace currently reports
   `Europe/Bucharest`).
2. Choose the Supabase project region nearest the user.
3. Create the development and production Supabase projects under the intended
   owner/billing account.
4. Confirm the email address used to claim the imported planner data. Do not
   place it in source control or this document.
5. Select an Android Keystore-backed secure storage plugin after reviewing its
   maintenance, Android support, and license.

### Decision record — 2026-08-22

- Canonical planner timezone: `Europe/Bucharest`.
- Development project: `Planner` (`uychwbumaseqbjkcyiyd`), West EU (Ireland),
  `eu-west-1`; baseline migration applied and verified.
- Production remains a distinct project to be created before Phase S5 cutover.
- The planner owner will use the same privately configured verified email on
  web and Android; the address is not stored in source control or this plan.
- Android secure storage selection: `@aparajita/capacitor-secure-storage` 8.x,
  to be installed and exercised during Phase S4.

## Completion Definition

The Supabase migration is complete only when the web and Android apps, signed
in as the same user, use the same RLS-protected Supabase planner data; existing
desktop data has been imported and verified without loss of relationships or
history; recurrence and task mutations are atomic and duplicate-safe; stale or
network-failed mutations are handled honestly; no client contains privileged
credentials; rollback artifacts remain available; and the project is ready for
the remaining product roadmap phases.
