# MyPlanner for Android

MyPlanner's Android edition uses the authenticated development Supabase project,
so Android and web show the same ownership-protected planner data. Planning,
completion, Kanban, recurrence, milestones, thoughts, focus notes, and progress
all use the same database and conflict-safe RPC contracts as the web app.

An internet connection is required to load and save planner data. When the
connection drops, the app keeps its current screen visible where possible and
offers an honest retry state rather than claiming that a change was saved.

## Sign in

Open the app, enter the same email used on web, and enter the one-time code sent
by Supabase. The resulting session is encrypted at rest using the Android
Keystore through `@aparajita/capacitor-secure-storage`.

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
npm run android:build
```

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
