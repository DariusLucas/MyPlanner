import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function signInWithGoogle(
  client: SupabaseClient<Database>,
  redirectTo: string,
  options: { automaticRedirect?: boolean } = {},
) {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: options.automaticRedirect === false,
    },
  });
  if (error) throw error;
  return data;
}
