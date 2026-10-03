# MyPlanner for Android

MyPlanner's Android edition uses the authenticated Supabase project selected by
the build environment, so Android and web show the same ownership-protected planner data. Planning,
completion, Kanban, recurrence, milestones, thoughts, focus notes, and progress
all use the same database and conflict-safe RPC contracts as the web app.

An internet connection is required to load and save planner data. When the
connection drops, the app keeps its current screen visible where possible and
offers an honest retry state rather than claiming that a change was saved.

## Sign in

Open the app and choose **Continue with Google**, using the same Google account
as web. Google opens in the system browser and returns to MyPlanner through its
registered deep link. The resulting Supabase session is encrypted at rest using
the Android Keystore through `@aparajita/capacitor-secure-storage`.

Only the public Supabase URL and publishable key are bundled in the APK. Never
put the service-role key, database password, access token, or pooler URL in a
`NEXT_PUBLIC_` or `VITE_` environment variable.

## Install the prepared APK

The installable debug APK is generated at:

`artifacts/MyPlanner-android-debug.apk`

Copy it to the Android phone, open it, and allow **Install unknown apps** for the
app used to open the file. Android may show a warning because this is a locally
built APK rather than a Play Store release.

## Build it again

Requirements:

- Node.js 22 or newer
- Android Studio with Android SDK 36
- Android Studio's bundled JDK 21, or `JAVA_HOME` pointing to JDK 21
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
  `.env.local` (the equivalent `VITE_` names are also supported)

From the repository root:

```powershell
npm install
npm run android:build:dev
```

Use `npm run android:build:dev` when testing against the local desktop app; it
uses `.env.local` and the development Supabase project. Use
`npm run android:build:prod` for a production-configured debug APK; it uses the distinct
ignored `.env.production.local` values when that file exists. Before installing
a production APK, verify that its public Supabase project URL is the production
project and keep the last development APK as the rollback artifact.

The generic `npm run android:build` command defaults to production mode. The
explicit commands prevent accidentally installing an APK connected to a
different Supabase environment than the web app being tested.

### Play Store bundle

The debug APK is not the Play Store upload. Build a signed Android App Bundle
with `npm run android:bundle:prod`. Configure these variables in a local secret
manager or CI secrets before running it:

```text
MYPLANNER_UPLOAD_STORE_FILE
MYPLANNER_UPLOAD_STORE_PASSWORD
MYPLANNER_UPLOAD_KEY_ALIAS
MYPLANNER_UPLOAD_KEY_PASSWORD
```

Do not commit or share the keystore or passwords. Enable Play App Signing and
keep an encrypted backup of the upload keystore. Set `MYPLANNER_VERSION_CODE`
to a new increasing integer for every release and `MYPLANNER_VERSION_NAME` to
the user-facing version. The release command stops if signing is not configured.
Production bundles load the public Supabase values from
`.env.production.local`; `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PUBLISHER_NAME`,
and `NEXT_PUBLIC_SUPPORT_EMAIL` must be real values before publishing.

The bundle still needs Play Console review, a completed Data safety form, and
working public Privacy Policy and account-deletion URLs.

The build helper compiles the Vite mobile runtime, synchronizes Capacitor,
registers the secure-storage plugin, finds the Android Studio JDK and SDK, and
creates:

`android/app/build/outputs/apk/debug/app-debug.apk`

For Android Studio development, use `npm run android:open`. When mobile code or
dependencies change, run `npm run android:sync` before rebuilding or running the
native project.

## Architecture

The Android entry point lives in `mobile/` and reuses the approved React UI.
Mobile route and action adapters replace Next.js server-only behavior with an
authenticated Supabase browser client. Sessions are persisted through encrypted
native storage, foreground/background events control token refresh, and
Supabase Realtime invalidates the current screen after remote planner changes.

The legacy SQLite files and dependency remain in the repository temporarily so
historical local data is not destroyed before cross-platform cutover is manually
verified. They are no longer imported by the Android runtime.

The S4 data-flow mapping is:

- Dashboard, week, focus-area, and progress reads query the same RLS-protected
  Supabase tables as web; recurring instances are materialized through
  `ensure_recurring_instances` before relevant reads.
- Task create, update, completion, move, reorder, workflow, recurrence, delete,
  and daily-focus mutations use the existing atomic planner RPCs with UUIDs and
  expected revisions.
- Thought and milestone mutations use ownership-scoped table operations with
  expected-revision filters and explicit stale/not-found handling.
- Realtime table changes invalidate the active mobile screen and reload it from
  the authoritative database.

The web preview of secure storage uses unencrypted browser `localStorage` for
development only. The packaged Android app uses the Android Keystore-backed
implementation.
