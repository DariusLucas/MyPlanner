import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getPublicSupabaseEnvironment } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseEnvironment();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Middleware/server actions
          // perform the refresh write during the authenticated web phase.
        }
      },
    },
  });
}
