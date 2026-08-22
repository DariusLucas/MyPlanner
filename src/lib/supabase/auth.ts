import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function requestEmailOtp(
  client: SupabaseClient<Database>,
  email: string,
) {
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(
  client: SupabaseClient<Database>,
  email: string,
  token: string,
) {
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  return data;
}
