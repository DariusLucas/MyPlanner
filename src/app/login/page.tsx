import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { safeNextPath } from "@/src/lib/safe-next-path";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; next?: string | string[]; deleted?: string }> }) {
  const query = await searchParams;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const next = safeNextPath(typeof query.next === "string" ? query.next : undefined);
  if (user) redirect(next);
  const initialError = typeof query.error === "string" ? query.error : undefined;
  const initialMessage = query.deleted === "1" ? "Your account and planner data have been deleted." : undefined;
  return <LoginForm initialError={initialError} initialMessage={initialMessage} next={next} />;
}
