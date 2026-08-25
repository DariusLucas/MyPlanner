export default function PlannerLoading() {
  return (
    <section className="mx-auto w-full max-w-[1500px]" aria-label="Loading planner">
      <div className="h-7 w-44 rounded-xl bg-muted" />
      <div className="mt-3 h-4 w-72 max-w-full rounded-lg bg-muted/70" />
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-[28px] border border-border bg-card/90" />
        <div className="h-56 rounded-[28px] border border-border bg-card/90" />
      </div>
    </section>
  );
}
