import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

const workspace = process.cwd();
const android = path.join(workspace, "android");
const windowsJdk = "C:\\Program Files\\Android\\Android Studio\\jbr";
const macJdk = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
const bundledJdk = process.platform === "win32" ? windowsJdk : macJdk;
const javaHome = existsSync(bundledJdk) ? bundledJdk : process.env.JAVA_HOME;
const defaultSdk =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA ?? homedir(), "Android", "Sdk")
    : process.platform === "darwin"
      ? path.join(homedir(), "Library", "Android", "sdk")
      : path.join(homedir(), "Android", "Sdk");
const androidSdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? defaultSdk;
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "production";
const releaseBundle = process.argv.includes("--release");

if (mode !== "development" && mode !== "production") {
  console.error(`Unsupported Android build mode: ${mode}. Use development or production.`);
  process.exit(1);
}

if (releaseBundle) {
  const signingValues = [
    process.env.MYPLANNER_UPLOAD_STORE_FILE,
    process.env.MYPLANNER_UPLOAD_STORE_PASSWORD,
    process.env.MYPLANNER_UPLOAD_KEY_ALIAS,
    process.env.MYPLANNER_UPLOAD_KEY_PASSWORD,
  ];
  if (signingValues.some((value) => !value)) {
    console.error("Release bundle requires the four MYPLANNER_UPLOAD_* signing variables. Store them in a local secret manager; do not commit them.");
    process.exit(1);
  }
  if (!existsSync(process.env.MYPLANNER_UPLOAD_STORE_FILE)) {
    console.error("The configured Android upload keystore file was not found.");
    process.exit(1);
  }
  if (mode !== "production") {
    console.error("A Play Store bundle must use --mode production.");
    process.exit(1);
  }
}

if (!javaHome) {
  console.error("Android Studio's bundled JDK was not found and JAVA_HOME is not set.");
  process.exit(1);
}

if (!existsSync(androidSdk)) {
  console.error("The Android SDK was not found. Install it with Android Studio or set ANDROID_HOME.");
  process.exit(1);
}

function run(command, args, cwd = workspace) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      ANDROID_HOME: androidSdk,
      ANDROID_SDK_ROOT: androidSdk,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build", "--config", "mobile/vite.config.ts", `--mode=${mode}`]);
run(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "android"]);
run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [releaseBundle ? "bundleRelease" : "assembleDebug"], android);

const builtArtifact = releaseBundle
  ? path.join(android, "app", "build", "outputs", "bundle", "release", "app-release.aab")
  : path.join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const artifacts = path.join(workspace, "artifacts");
const installableArtifact = path.join(artifacts, releaseBundle ? "MyPlanner-release.aab" : "MyPlanner-android-debug.apk");

if (!existsSync(builtArtifact)) {
  console.error(`Android build completed without producing ${builtArtifact}.`);
  process.exit(1);
}

mkdirSync(artifacts, { recursive: true });
copyFileSync(builtArtifact, installableArtifact);
console.log(`Android artifact: ${installableArtifact}`);
