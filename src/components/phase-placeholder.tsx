import { LockKeyhole } from "lucide-react";

export function PhasePlaceholder({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-[26px] border border-border bg-card p-7 shadow-[0_18px_48px_rgba(70,58,42,0.07)] backdrop-blur-xl">
      <div className="mb-5 grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><LockKeyhole size={17} strokeWidth={1.7} /></div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{phase}</p>
      <h1 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-5 text-xs text-muted-foreground">This area will become available in its planned phase.</p>
    </section>
  );
}
