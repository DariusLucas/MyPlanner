import { createClient } from "@supabase/supabase-js";
import { getLocalSupabaseEnvironment } from "./supabase-env";
import type { Database } from "../src/lib/supabase/database.types";

async function main() {
  const { publishableKey, supabaseUrl } = getLocalSupabaseEnvironment();
  const client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });
  const email = process.env.PLANNER_AUTH_TEST_EMAIL?.trim().toLowerCase();
  const password = process.env.PLANNER_AUTH_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("Set PLANNER_AUTH_TEST_EMAIL and PLANNER_AUTH_TEST_PASSWORD locally before running this check.");
  }

  try {
    if (!email.includes("@")) throw new Error("Enter a valid email address.");
    const verification = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (verification.error) throw verification.error;
    const user = verification.data.user;
    if (!user) throw new Error("Authentication succeeded without a user session.");

    const settings = await client
      .from("app_settings")
      .upsert({ user_id: user.id, timezone: "Europe/Bucharest" })
      .select("user_id, timezone")
      .single();
    if (settings.error) throw settings.error;
    if (settings.data.user_id !== user.id || settings.data.timezone !== "Europe/Bucharest") {
      throw new Error("Authenticated RLS settings check returned unexpected data.");
    }

    console.log("Email/password session and per-user RLS check passed.");
  } finally {
    await client.auth.signOut();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
