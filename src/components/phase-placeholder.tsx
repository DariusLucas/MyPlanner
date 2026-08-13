import { ArrowRight, LockKeyhole } from "lucide-react";

export function PhasePlaceholder({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
      <div className="mb-7 grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><LockKeyhole size={19} strokeWidth={1.7} /></div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{phase}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Foundation first <ArrowRight size={15} /></div>
    </section>
  );
}
