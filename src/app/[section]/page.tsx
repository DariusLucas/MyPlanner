import { PhasePlaceholder } from "@/src/components/phase-placeholder";

const sections: Record<string, { title: string; phase: string; description: string }> = {
  goals: { title: "Goals", phase: "Phase 3", description: "Goals, sprints, weekly outcomes, and targets will be connected here in the next planning phase." },
  plan: { title: "Plan", phase: "Phase 3", description: "Weekly planning will be added after the core schema and database lifecycle are stable." },
  career: { title: "Career", phase: "Phase 4", description: "Job applications, networking, and technical learning will be added as focused career tools." },
  content: { title: "Content", phase: "Phase 5", description: "The content pipeline will be added after the foundation and planning layers are complete." },
  progress: { title: "Progress", phase: "Phase 6", description: "Progress calculations and visualizations will be derived from real activity after those activity systems exist." },
  review: { title: "Review", phase: "Phase 7", description: "Daily and weekly reflection workflows will be added after the execution and progress layers." },
  settings: { title: "Settings", phase: "Phase 1", description: "Theme preferences are available in the top-right control. More settings will be added only when their underlying behavior exists." },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section] ?? { title: "Not found", phase: "", description: "This section does not exist." };
  return <PhasePlaceholder {...content} />;
}
