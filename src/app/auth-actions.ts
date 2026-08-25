"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export async function signOut() {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/login");
}
