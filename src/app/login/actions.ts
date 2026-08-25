"use server";

import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function initializeSignedInPlanner() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, error: "Your sign-in could not be confirmed." };
  }

  const { error: settingsError } = await client.from("app_settings").upsert(
    {
      user_id: data.user.id,
      timezone: "Europe/Bucharest",
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (settingsError) {
    return { ok: false as const, error: "Your planner could not be initialized." };
  }
  return { ok: true as const };
}
