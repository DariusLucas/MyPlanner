# Phase S3 — Web Migration

## Objective

Move the web planner from its SQLite runtime to the authenticated Supabase
development project while preserving the approved UI, existing planner data
contracts, and task behavior.

## Required Behavior

- Provide a web sign-in flow using email OTP authentication.
- Persist and refresh the Supabase session through the Next.js server/browser
  cookie clients.
- Protect planner routes and server actions from unauthenticated access.
- Replace web SQLite reads and writes with authenticated Supabase queries and
  the ownership-safe planner RPCs.
- Preserve current UI behavior, visual design, timezone handling, task history,
  revisions, recurrence behavior, and conflict/error semantics.
- Keep Android on SQLite until Phase S4.

## Implementation Checklist

- [ ] Add the web login route with email and one-time-code states.
- [ ] Add session refresh/middleware behavior for browser navigation and server
      rendering.
- [ ] Add authenticated route and action guards with clear signed-out behavior.
- [ ] Introduce web planner data-access modules backed by Supabase types and
      RPCs; keep table/RPC details out of presentational components.
- [ ] Migrate dashboard, week, task, focus, recurrence, and progress flows from
      SQLite without changing their user-facing contracts.
- [ ] Preserve optimistic revision handling and user-visible conflict errors.
- [ ] Verify that no service-role credential, database password, or connection
      string reaches browser bundles or client-visible output.
- [ ] Run existing tests, typecheck, lint, build, and Supabase integration
      checks, plus manual signed-out/signed-in web verification.

## Explicitly Out of Scope

- Do not migrate Android SQLite or add Android secure session storage; that is
  Phase S4.
- Do not import the desktop SQLite database or create production planner rows;
  that is Phase S5.
- Do not create the production project or perform production cutover.
- Do not add profiles, OAuth, passwords, passkeys, sharing, teams, offline
  queues, conflict merging, push notifications, or backup UI.
- Do not redesign the approved visual system.
- Do not delete SQLite migrations or rewrite existing local data.

## Completion Criteria

Phase S3 is complete only when the complete web planner works against the
development Supabase project with email OTP sign-in, cookie-backed session
refresh, protected routes, authenticated Supabase reads/writes and RPCs, no
SQLite runtime dependency in the web app, no privileged credentials in client
outputs, and all relevant automated and manual checks passing.

## Relevant Dependencies from Previous Phases

- S2 established the applied PostgreSQL schema, generated database types,
  ownership-safe RLS, atomic planner RPCs, Supabase clients, and verified email
  OTP behavior.
- Existing SQLite behavior and UI contracts remain the parity source of truth
  during the web cutover.
- The publishable Supabase key is client-safe; service-role credentials,
  database passwords, and connection strings remain server/import-only.
- `SUPABASE_MIGRATION_PLAN.md` remains the detailed architecture and security
  reference for the cutover.
