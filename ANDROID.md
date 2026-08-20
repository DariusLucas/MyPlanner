# MyPlanner for Android

MyPlanner's Android edition is a standalone, offline-first app. Tasks, thoughts,
focus notes, milestones, and progress are stored in a SQLite database in the
phone's private app storage. It does not need the desktop server or an internet
connection after installation.

## Install the prepared APK

The installable debug APK is generated at:

`artifacts/MyPlanner-android-debug.apk`

Copy it to the Android phone, open it, and allow **Install unknown apps** for the
app used to open the file. Android may show a warning because this is a locally
built APK rather than a Play Store release.

The Android database is separate from the desktop database. Uninstalling the
Android app removes its private data. Desktop/mobile transfer and backup are not
included yet, so do not uninstall the app if it contains data you need to keep.

## Build it again

Requirements:

- Node.js 22 or newer
- Android Studio with Android SDK 36
- Android Studio's bundled JDK 21, or `JAVA_HOME` pointing to JDK 21

From the repository root:

```powershell
npm install
npm run android:build
```

The build helper compiles the Vite mobile runtime, synchronizes Capacitor, finds
the Android Studio JDK and SDK, and creates:

`android/app/build/outputs/apk/debug/app-debug.apk`

For Android Studio development, use `npm run android:open`. When web code changes,
run `npm run android:sync` before rebuilding or running the native project.

## Architecture

The desktop app remains a Next.js app backed by its local SQLite database. The
Android entry point lives in `mobile/`, reuses the existing React UI, and replaces
server-only Next.js actions and routing with native equivalents. Capacitor packages
the static mobile bundle and `@capacitor-community/sqlite` provides on-device data.

The current APK is suitable for direct personal installation. Publishing through
Google Play would additionally require a signed release build and Play Console
setup.
