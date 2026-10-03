"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

export async function deleteCurrentAccount(): Promise<DeleteAccountResult> {
  const client = await createSupabaseServerClient();
  const { data, error: authError } = await client.auth.getUser();
  if (authError || !data.user) {
    return { ok: false, error: "Sign in again before deleting your account." };
  }

  const { error } = await client.functions.invoke("delete-account", {
    body: { confirm: true },
  });
  if (error) {
    return { ok: false, error: "We couldn't delete the account. Please try again or contact support." };
  }

  await client.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
