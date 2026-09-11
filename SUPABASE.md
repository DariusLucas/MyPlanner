# Supabase Development Setup

The committed `supabase/` directory and migrations are the source of truth for
the cloud database schema. The existing SQLite database contains disposable
development data and is not part of the cloud cutover.

## Development setup

1. Copy `.env.example` to `.env.local` and replace the placeholders locally.
2. Never commit `.env.local`, database passwords, service-role keys, access
   tokens, or complete connection strings containing a real password.
3. Use the verified empty `Planner` Supabase project as the remote development
   environment.
4. Apply committed migrations to that project before testing application code.

Use `SUPABASE_DB_URL` for migrations and administrative tooling because it points to
the session-mode pooler on port 5432. `SUPABASE_POOLER_URL` is the optional
transaction-mode connection on port 6543. Browser and Android code must use
the Supabase Data API URL and publishable key, never either PostgreSQL URL.

The existing `DATABASE_URL` name selects the legacy SQLite file used by the
local application and test suite. It is not a migration source.

## Remote environments

Development and production must use separate Supabase projects. Link the CLI
to development only while building and testing the schema. Review generated
SQL before running `npm run supabase:push`; never exercise destructive import
or reset workflows against production first.

The user approved using remote development without Docker/WSL on 2026-08-22.
The committed local Supabase configuration remains available if a containerized
environment becomes useful later, but it is not an S1 gate.

The remote development project is `Planner`, reference
`uychwbumaseqbjkcyiyd`, in West EU (Ireland), `eu-west-1`. Its dashboard was
verified on 2026-08-22. Store credentials only in the ignored local environment
file or an approved secret manager.

The canonical planner timezone is `Europe/Bucharest`. The supplied project is
treated as development until a distinct production project is created and
recorded before cutover.

The distinct production project is `MyPlanner Production`, reference
`iicwadngdwxgjodxkdnb`, in West EU (Ireland), `eu-west-1`. Its credentials are
stored only in the ignored `.env.production.local` file.

The existing publishable key is configured in the ignored `.env.local` for web
and Android. A personal access token is not required for the current direct
database workflow. The service-role key remains unconfigured until the
server-only import/verification phase needs it.

## S2 passwordless Auth check

The development project has email Auth enabled. Supabase's built-in sender
currently locks the `Magic link or OTP` template to a magic-link body. To use
the approved six-digit email-code flow, first configure a custom SMTP provider
under **Authentication → Emails → SMTP Settings**, then change the template
body under **Authentication → Emails → Templates → Magic link or OTP** so it
contains `{{ .Token }}`.

The Android client also supports the existing magic-link template as a fallback.
Add `com.myplanner.app://auth/callback` to **Authentication → URL Configuration
→ Redirect URLs** in the Supabase dashboard. The Android app registers that
custom URL and exchanges the returned session in-app instead of leaving the
user in Chrome. This is required for magic-link sign-in; it does not change the
preferred six-digit code flow once the email template is configured with
`{{ .Token }}`.

After that dashboard configuration, run `npm run test:supabase-auth`. Enter a
real email address, copy the received code into the prompt, and confirm that
the script reports that email OTP, the authenticated session, and the
per-user RLS check passed. The script creates only that Auth user and its own
`app_settings` row in the development project.

## Required remote dashboard values

- Project URL and publishable key from API settings.
- Service-role key for server-only import/verification tooling.
- Database password for the session-mode pooler.
- A personal access token for non-interactive CLI project linking.

Do not paste secret values into issues, documentation, source files, client
code, Android assets, screenshots, build logs, or chat transcripts.

## S5 fresh-cloud cutover

The SQLite records are disposable development data. Do not build or run a
SQLite-to-Supabase importer, create a migration snapshot, or attempt a reverse
conversion. Start with an empty Supabase development dataset, apply the
committed migrations, create fresh test records through the authenticated web
and Android clients, and verify RLS, Realtime, session restoration, network
errors, stale writes, and planner output parity.

The development-only cleanup command is deliberately confirmation-gated:

```powershell
npm run supabase:reset-dev-planner -- --confirm-development-reset
npm run test:fresh-supabase
```

It deletes planner rows only in the known development project. It does not
delete Auth users, production data, or SQLite files.

### Production cutover procedure

Production uses the ignored `.env.production.local` file. Create it once with
`npm run supabase:prepare-production`; the command generates a strong database
password without printing it or overwriting an existing file. Add the distinct
production project URL, publishable key, and session-mode pooler URL after the
project is created. Never copy development credentials into this file.

Apply and verify the reviewed schema with:

```powershell
npm run supabase:apply-all -- --env-file .env.production.local --confirm-production
npm run test:fresh-supabase -- --env-file .env.production.local
npm run test:supabase -- --env-file .env.production.local
```

The explicit production confirmation flag prevents an accidental migration to
an unrecognized project. `test:supabase` runs its test records inside a rolled
back transaction. After these checks pass, build the web and Android clients;
production-mode builds load `.env.production.local` ahead of `.env.local`.

During the release window, stop writes to the development planner, sign in to
production with the same private email on web and Android, create fresh planner
records, and verify bidirectional changes. If verification fails, restore the
last development-configured web build and Android APK. Do not delete either
Supabase project or the legacy SQLite database while rollback is still needed.

## S6 stabilization

The backup UI and client integration were intentionally removed from the active
web and Android product scope. The already-applied migration remains in schema
history so deployed environments are not modified destructively.

## Android secure session storage decision

Use `@aparajita/capacitor-secure-storage` version 8.x when Phase S4 adds the
Android Supabase session adapter. It explicitly supports Capacitor 8, uses an
AES-GCM key generated by Android KeyStore with app-scoped SharedPreferences,
and is MIT licensed. Do not use its unencrypted web fallback; the Next.js app
will use Supabase's cookie-based SSR client instead. Install and exercise the
plugin during S4 so an unused native dependency is not shipped early.
