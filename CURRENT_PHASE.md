# Phase S4 — Android Migration

## Objective

Move the Android planner from its SQLite runtime to the authenticated
development Supabase project so Android and web use the same ownership-safe
planner data, while preserving the approved mobile UI and existing task
behavior.

## Required Behavior

- Replace Android SQLite reads and writes with authenticated Supabase client
  access and the existing ownership-safe RPCs.
- Add Android email OTP sign-in and secure session storage using the selected
  Keystore-backed `@aparajita/capacitor-secure-storage` 8.x plugin.
- Provide clear loading, offline/network-error, signed-out, and session-expired
  states without exposing privileged credentials.
- Add Realtime invalidation so Android reflects planner changes initiated from
  web and refreshes data honestly after remote changes.
- Preserve Android task, recurrence, focus, progress, timezone, revision, and
  conflict behavior.
- Update Android documentation and mobile Settings copy for Supabase-backed
  synchronization.
- Keep the approved visual design and mobile interaction language.

## Implementation Checklist

- [ ] Audit the Android SQLite data/actions and map each flow to the web
      Supabase repository and RPC contracts.
- [ ] Add Android Supabase client configuration using only publishable values.
- [ ] Install and exercise Keystore-backed secure session storage.
- [ ] Implement Android email OTP sign-in, sign-out, session refresh, and
      signed-out/session-expired routing.
- [ ] Migrate dashboard, week, task, recurrence, focus, and progress reads and
      writes to Supabase.
- [ ] Add loading, network-error, retry, and optimistic-conflict states.
- [ ] Add Realtime invalidation and refresh behavior for shared planner data.
- [ ] Update Android documentation and Settings copy.
- [ ] Run Android and web builds, all relevant tests, migration/security checks,
      and manual cross-platform verification.

## Current Verification Status

- Phase S3 web migration is complete and committed as the prerequisite for this
  phase.
- The development Supabase schema, RLS policies, planner RPCs, and web parity
  behavior are available for Android integration.
- Android still uses SQLite until the S4 migration is implemented and verified.

## Explicitly Out of Scope

- Do not import the desktop SQLite database; that is Phase S5.
- Do not create or cut over to a production Supabase project; that is Phase S5.
- Do not implement backup/import UI; that is Phase S6.
- Do not redesign the approved visual system.
- Do not delete SQLite migrations or rewrite historical local data before the
  Android cutover is verified.
- Do not add sharing, teams, push notifications, or speculative planner
  features.

## Completion Criteria

Phase S4 is complete only when Android and web, signed in as the same user, use
the same development Supabase planner data; Android builds successfully; OTP
sessions are securely stored and refresh correctly; loading, network, conflict,
and signed-out states are verified; Realtime invalidation reflects changes
from either platform; and all relevant automated and manual checks pass.

## Relevant Dependencies from Previous Phases

- S2 provides the applied PostgreSQL schema, generated types, ownership-safe
  RLS, atomic planner RPCs, and verified email OTP behavior.
- S3 provides the web session model, route/action guard expectations, Supabase
  planner mappings, conflict semantics, and shared UI/data contracts.
- The selected Android secure-storage dependency is
  `@aparajita/capacitor-secure-storage` 8.x.
- The canonical development planner timezone is `Europe/Bucharest`.
- The development Supabase project is `Planner` in West EU (Ireland);
  production remains out of scope until S5.
