import { Database, Layers3, ShieldCheck } from "lucide-react";
import { getFoundationSummary } from "@/src/lib/foundation";
import { foundationStats } from "@/src/lib/navigation";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const summary = getFoundationSummary();

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Phase 1 · Foundation</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">A clear place to turn ambition into action.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">The application shell is ready. We are establishing reliable local persistence and the shared structure before adding daily task workflows.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-muted"><Database size={18} strokeWidth={1.7} /></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${summary.databaseReady ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{summary.databaseReady ? "Connected" : "Needs setup"}</span></div>
          <h2 className="text-lg font-semibold">Local database</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">SQLite is the source of truth on this computer. Drizzle migrations keep the schema explicit and repeatable.</p>
          {!summary.databaseReady && <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Run <code className="font-mono text-foreground">npm run db:setup</code> once to initialize the database.</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 grid size-10 place-items-center rounded-xl bg-muted"><ShieldCheck size={18} strokeWidth={1.7} /></div>
          <h2 className="text-lg font-semibold">Private by default</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">No accounts, analytics, telemetry, or external database connections are part of this foundation.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Foundation status</p><h2 className="mt-2 text-xl font-semibold">{summary.name}</h2></div><div className="grid size-10 place-items-center rounded-xl bg-muted"><Layers3 size={18} strokeWidth={1.7} /></div></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatusItem label="Goals in database" value={summary.counts.goals} />
          <StatusItem label="Sprints in database" value={summary.counts.sprints} />
          <StatusItem label="Tasks in database" value={summary.counts.tasks} />
        </div>
        <div className="mt-8 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
          {foundationStats.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 text-sm"><Icon size={16} className="text-muted-foreground" strokeWidth={1.7} /><span className="text-muted-foreground">{label}</span><span className="ml-auto font-medium">{value}</span></div>)}
        </div>
      </section>
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-muted/65 p-4"><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}
