import Link from "next/link";

export function PrivacyPolicyContent({
  publisher,
  supportEmail,
  showWebDeletionLink = true,
}: {
  publisher?: string;
  supportEmail?: string;
  showWebDeletionLink?: boolean;
}) {
  return (
    <article className="privacy-policy-page mx-auto w-full max-w-[760px] space-y-7 rounded-[22px] border border-border bg-card/80 p-6 shadow-sm sm:p-9">
      <header className="space-y-2">
        <p className="dashboard-eyebrow">MyPlanner</p>
        <h1 className="text-3xl font-semibold tracking-[-.055em]">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: October 3, 2026</p>
        <p className="text-sm leading-6">This policy describes how {publisher || "the MyPlanner publisher"} handles information when you use MyPlanner.</p>
      </header>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Information processed</h2><p className="text-sm leading-6 text-muted-foreground">When you sign in with Google, MyPlanner receives account information needed to identify your account, including your email address and provider account identifier. Planner information you enter may include tasks, categories, milestones, quick thoughts, completion history, preferences, and timestamps. The app also processes authentication session data to keep you signed in.</p></section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">How information is used</h2><p className="text-sm leading-6 text-muted-foreground">The information is used to authenticate you, save and synchronize your planner between supported clients, show your planner and progress, and maintain the security and operation of the service. MyPlanner does not use planner content for advertising and does not sell personal information.</p></section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Service providers</h2><p className="text-sm leading-6 text-muted-foreground">Google provides the sign-in service. Supabase provides authentication, database, and application API infrastructure. Planner records are stored in the configured Supabase project, currently hosted in the European Union (Ireland). These providers process information to provide their services under their own terms and privacy policies.</p></section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Security and retention</h2><p className="text-sm leading-6 text-muted-foreground">Access to planner records is restricted by authenticated ownership policies in the database. Network traffic uses HTTPS, and Android stores its authentication session using Android Keystore-backed secure storage. We retain account and planner records while the account remains active. When you delete your account, the account and associated planner records are removed from the application database. Limited provider operational or security logs may follow provider retention periods.</p></section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Your choices and deletion</h2><p className="text-sm leading-6 text-muted-foreground">You can permanently delete your account and planner data from Account settings{showWebDeletionLink && <> or through the <Link className="underline" href="/delete-account">web deletion page</Link></>}. You can also contact support with privacy questions or requests.</p></section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Contact</h2><p className="text-sm leading-6 text-muted-foreground">Publisher: {publisher || "Publisher name must be configured before launch."}<br />Privacy contact: {supportEmail ? <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> : "A monitored support email must be configured before launch."}</p></section>
    </article>
  );
}
