# Phase S5 Cutover Report

Date: 2026-09-06

## Development acceptance

- Development Supabase project: `Planner` (`uychwbumaseqbjkcyiyd`), West EU
  (Ireland).
- SQLite development records were declared disposable and excluded from the
  cloud cutover.
- All seven committed migrations are applied.
- Automated migration history, schema, Auth availability, RLS isolation,
  revisions, RPC, event-history, recurrence, web-boundary, mobile-contract,
  typecheck, lint, build, and core planner checks pass.
- The user manually verified the Android client and reported that all tested
  behavior works on 2026-09-02.

## Production cutover

- [x] Create `MyPlanner Production` as a distinct Supabase project in West EU
      (Ireland).
- [x] Production project reference: `iicwadngdwxgjodxkdnb`.
- [x] Complete the ignored `.env.production.local` configuration.
- [x] Apply all reviewed migrations with the explicit production guard.
- [x] Verify the empty production dataset and run transactional RLS/RPC tests.
- [x] Build the web client and Android APK against production.
- [x] Sign in to both clients with the same private production account.
- [x] Verify Dashboard, Today, This Week, Career, Content, and Progress.
- [x] Verify web-to-Android and Android-to-web Realtime refresh.
- [x] Verify session restoration, offline/network errors, and stale writes.

Production verification was confirmed complete by the user on 2026-09-06.

## Rollback artifacts

- The legacy SQLite database and migrations remain untouched.
- The development Supabase project remains available.
- Keep the last development-configured web build and Android APK until the
  production checks are accepted.
- If production verification fails, return both clients to the development
  configuration; do not reverse-convert production data into SQLite.

## Acceptance

Phase S5 is complete only after every production item above is checked and the
project roadmap is advanced to Phase S6.
