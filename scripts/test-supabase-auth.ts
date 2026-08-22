import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getLocalSupabaseEnvironment } from "./supabase-env";
import type { Database } from "../src/lib/supabase/database.types";

async function main() {
  const { publishableKey, supabaseUrl } = getLocalSupabaseEnvironment();
  const prompt = createInterface({ input, output });
  const client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  try {
    const email = (await prompt.question("Email for your private planner: ")).trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email address.");

    const request = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (request.error) throw request.error;

    console.log(
      "Check your email for the one-time code. If it contains only a sign-in link, configure custom SMTP and the {{ .Token }} template described in SUPABASE.md.",
    );
    const token = (await prompt.question("One-time code: ")).trim();
    const verification = await client.auth.verifyOtp({ email, token, type: "email" });
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

    await client.auth.signOut();
    console.log("Email OTP, authenticated session, and per-user RLS check passed.");
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
