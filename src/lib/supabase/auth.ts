import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const minimumPasswordLength = 8;

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: string) {
  if (password.length < minimumPasswordLength) {
    throw new Error(`Use at least ${minimumPasswordLength} characters for your password.`);
  }
}

export async function signInWithEmailPassword(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
) {
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail(email),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmailPassword(
  client: SupabaseClient<Database>,
  email: string,
  password: string,
  options: { redirectTo?: string } = {},
) {
  validatePassword(password);
  const { data, error } = await client.auth.signUp({
    email: normalizedEmail(email),
    password,
    options: options.redirectTo ? { emailRedirectTo: options.redirectTo } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(
  client: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
) {
  const { error } = await client.auth.resetPasswordForEmail(normalizedEmail(email), {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(
  client: SupabaseClient<Database>,
  password: string,
) {
  validatePassword(password);
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

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
