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

## Google-only authentication

MyPlanner exposes Google sign-in on web and Android. Email/password sign-in and
password recovery are not part of the app flow. Existing planner records and
ownership remain in place; a Google session must resolve to the same Supabase
user to access those records.

In each hosted Supabase project, open **Authentication → Sign In / Providers**
and disable Email as a sign-in provider when ready to enforce Google-only auth
at the service level. The app code alone cannot change hosted provider settings.

Under **Authentication → URL Configuration**, set the production Site URL and
allow the web and Android OAuth callbacks. Development needs:

```text
http://127.0.0.1:3000/auth/callback
http://localhost:3000/auth/callback
com.myplanner.app://auth/callback
```

Add the equivalent exact HTTPS callback URLs for the deployed web app. The
Android callback is already registered in `AndroidManifest.xml`; Google OAuth
returns through the encrypted-session flow.

For the public web app's return-to-page flow, also allow the production
`https://<site-domain>/auth/callback**` redirect pattern. The application
validates the `next` target as a same-site path before redirecting.

### Google provider setup

Google requires credentials owned by the Google Cloud account; they must never
be committed to this repository. In Google Auth Platform:

1. Configure Branding, Audience, and the `openid`, email, and profile scopes.
2. Create an OAuth client of type **Web application**.
3. Add the web app origins, including the local origin while testing.
4. Add Supabase's provider callbacks as authorized redirect URIs:

```text
https://uychwbumaseqbjkcyiyd.supabase.co/auth/v1/callback
https://iicwadngdwxgjodxkdnb.supabase.co/auth/v1/callback
```

The current private setup uses one Google OAuth client whose redirect allowlist
contains both Supabase project callbacks. Its client ID and secret are stored
only in each project's **Authentication → Sign In / Providers → Google**
settings. A public or multi-environment deployment can split these into distinct
clients later for stronger isolation. Google automatically links to an existing
Supabase user when it returns the same verified email, so the planner `user_id`
and its data remain unchanged.

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

## Account deletion

The web and Android account settings call the `delete-account` Edge Function.
It requires a valid signed-in user JWT, verifies that JWT with Supabase Auth,
and deletes only that authenticated user's Auth account. Planner tables reference
`auth.users` with `ON DELETE CASCADE`, so the user's planner rows are removed in
the database deletion. The function is configured with JWT verification enabled
and uses the platform-provided service-role secret only inside the function
runtime. Never put that key in either client bundle.

Deploy the function to the intended project explicitly after reviewing the
target project and its current Auth/database configuration:

```powershell
npx supabase functions deploy delete-account --project-ref <project-ref>
```

The public `/delete-account` page requires the owner to sign in with the Google
account linked to the planner before confirming deletion. The same action is
available in web and Android account settings.

## Free-plan cost boundary

MyPlanner uses Supabase Auth and the Data API. The account-deletion function
uses the included Edge Functions service. Keep both projects on the Free plan
and do not enable paid add-ons, custom domains, larger compute, or paid
point-in-time recovery without reviewing the cost first. Free-plan usage limits
can restrict service instead of generating overage charges. Free projects may
pause after a week of low activity, and the Free plan does not provide
downloadable managed database backups. An independent backup process is needed
if recovery of user data is required.

## Android secure session storage decision

Use `@aparajita/capacitor-secure-storage` version 8.x when Phase S4 adds the
Android Supabase session adapter. It explicitly supports Capacitor 8, uses an
AES-GCM key generated by Android KeyStore with app-scoped SharedPreferences,
and is MIT licensed. Do not use its unencrypted web fallback; the Next.js app
will use Supabase's cookie-based SSR client instead. Install and exercise the
plugin during S4 so an unused native dependency is not shipped early.
