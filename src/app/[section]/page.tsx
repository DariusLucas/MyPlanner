import { notFound } from "next/navigation";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { getFocusAreaData, type FocusArea } from "@/src/lib/focus-areas";
import { WeekView } from "@/src/components/week-view";
import { getWeekData, normalizeWeekStart } from "@/src/lib/week";

const sections: Record<string, { title: string; description: string }> = {
  progress: { title: "Progress", description: "Progress will be based on completed work once there is enough activity to show." },
  settings: { title: "Settings", description: "Theme controls are available in the sidebar. Additional settings will be introduced only when they support an active workflow." },
};

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ week?: string | string[] }> }) {
  const { section } = await params;
  if (section === "week") {
    const query = await searchParams;
    return <WeekView data={getWeekData(normalizeWeekStart(query.week))} />;
  }
  if (section === "career" || section === "content") return <FocusAreaView data={getFocusAreaData(section as FocusArea)} />;
  const content = sections[section];
  if (!content) notFound();

  return <section className="mx-auto flex min-h-[360px] max-w-xl flex-col justify-center"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em]">{content.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content.description}</p></section>;
}
