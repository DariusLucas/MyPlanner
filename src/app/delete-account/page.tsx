import Link from "next/link";
import { DeleteAccountControl } from "@/src/components/delete-account-control";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getUser();

  return (
    <section className="mx-auto w-full max-w-[680px] space-y-5 rounded-[22px] border border-border bg-card/80 p-6 shadow-sm sm:p-8">
      <p className="dashboard-eyebrow">MyPlanner account</p>
      <h1 className="text-3xl font-semibold tracking-[-.055em]">Delete account and data</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        You can permanently delete your MyPlanner account and the planner data linked to it. The request deletes the account and its records from the planner database.
      </p>
      {data.user ? (
        <div className="space-y-4 rounded-2xl border border-border p-4">
          <p className="text-sm">Signed in as <strong>{data.user.email ?? "your Google account"}</strong>.</p>
          <DeleteAccountControl />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-sm leading-6">Sign in with the Google account connected to your planner, then return here to submit the deletion request.</p>
          <Link className="premium-primary-button inline-flex" href="/login?next=%2Fdelete-account">Continue with Google</Link>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Read the <Link className="underline" href="/privacy">Privacy Policy</Link> for contact and data handling details.</p>
    </section>
  );
}
