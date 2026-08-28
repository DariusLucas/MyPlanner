import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase public environment configuration is missing.");
}

const secureSessionStorage = {
  async getItem(key: string) {
    const value = await SecureStorage.get(key);
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string) {
    await SecureStorage.set(key, value);
  },
  async removeItem(key: string) {
    await SecureStorage.remove(key);
  },
};

export const mobileSupabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: secureSessionStorage,
    },
  },
);

export class MobileAuthError extends Error {
  constructor(message = "Your session has expired. Sign in again.") {
    super(message);
    this.name = "MobileAuthError";
  }
}

export class MobileDataError extends Error {
  constructor(message = "Something went wrong. Check your connection and try again.") {
    super(message);
    this.name = "MobileDataError";
  }
}

export async function requireMobileSession(): Promise<Session> {
  const { data, error } = await mobileSupabase.auth.getSession();
  if (error || !data.session) throw new MobileAuthError();
  return data.session;
}

export async function initializeMobilePlanner() {
  const session = await requireMobileSession();
  const { error } = await mobileSupabase.from("app_settings").upsert(
    {
      user_id: session.user.id,
      name:
        typeof session.user.user_metadata?.name === "string"
          ? session.user.user_metadata.name
          : "My Planner",
      timezone: "Europe/Bucharest",
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (error) throw new MobileDataError(error.message);
}

export async function signOutMobilePlanner() {
  const { error } = await mobileSupabase.auth.signOut();
  if (error) throw new MobileDataError(error.message);
}
