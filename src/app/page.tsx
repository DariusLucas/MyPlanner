import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, LockKeyhole } from "lucide-react";
import { getFoundationSummary } from "@/src/lib/foundation";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const summary = getFoundationSummary();

  return (
    <div className="space-y-6">
      <section className="max-w-2xl">
        <p className="text-sm text-muted-foreground">Your personal workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Keep the next step clear.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The foundation is ready. Use Today to turn what matters into a small, doable checklist.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Start here</p>
            <h2 className="mt-1 text-lg font-semibold">Plan today, then do it.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add only the actions you can meaningfully finish.</p>
          </div>
          <Link href="/today" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90">Open Today <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={CheckCircle2} title="Today tasks" value={summary.counts.tasks} description="saved in your planner" />
        <InfoCard icon={Database} title="Your data" value={summary.databaseReady ? "Ready" : "Setup needed"} description={summary.databaseReady ? "stored locally on this computer" : "run the database setup once"} />
        <InfoCard icon={LockKeyhole} title="Privacy" value="Local only" description="no account or cloud connection" />
      </section>

      <section className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">What is available now</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FeatureRow title="Foundation" description="Local database, theme preferences, and navigation are working." status="Ready" />
          <FeatureRow title="Today" description="Create tasks, set daily focus, complete, edit, reorder, or move them." status="Ready" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Goals, planning, career, content, progress, and review will appear here when their dedicated phases are built.</p>
      </section>
    </div>
  );
}

function InfoCard({ icon: Icon, title, value, description }: { icon: typeof CheckCircle2; title: string; value: string | number; description: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><Icon size={16} className="text-muted-foreground" /><p className="mt-4 text-xs font-medium text-muted-foreground">{title}</p><p className="mt-1 text-base font-semibold">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>;
}

function FeatureRow({ title, description, status }: { title: string; description: string; status: string }) {
  return <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={13} /></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium">{title}</p><span className="text-[11px] text-emerald-700 dark:text-emerald-300">{status}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}
