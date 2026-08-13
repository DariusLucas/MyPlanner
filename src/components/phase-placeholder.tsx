import { LockKeyhole } from "lucide-react";

export function PhasePlaceholder({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6">
      <div className="mb-5 grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><LockKeyhole size={17} strokeWidth={1.7} /></div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{phase}</p>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-5 text-xs text-muted-foreground">This area will become available in its planned phase.</p>
    </section>
  );
}
