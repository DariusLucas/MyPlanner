import { notFound } from "next/navigation";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { getFocusAreaData, type FocusArea } from "@/src/lib/focus-areas";
import { WeekView } from "@/src/components/week-view";
import { getWeekData, normalizeWeekStart } from "@/src/lib/week";
import { ProgressView } from "@/src/components/progress-view";
import { localDateInTimeZone, systemTimeZone } from "@/src/lib/progress";
import { getProgressTaskHistory } from "@/src/lib/progress-query";
import { normalizeProgressCategory, normalizeProgressRange } from "@/src/lib/progress-visuals";

export const dynamic = "force-dynamic";

const sections: Record<string, { title: string; description: string }> = {
  settings: { title: "Settings", description: "Theme controls are available in the sidebar. Additional settings will be introduced only when they support an active workflow." },
};

type SectionSearchParams = {
  week?: string | string[];
  range?: string | string[];
  category?: string | string[];
};

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SectionSearchParams> }) {
  const { section } = await params;
  const query = await searchParams;
  if (section === "week") {
    return <WeekView data={getWeekData(normalizeWeekStart(query.week))} />;
  }
  if (section === "career" || section === "content") return <FocusAreaView data={getFocusAreaData(section as FocusArea)} />;
  if (section === "progress") {
    const range = normalizeProgressRange(query.range);
    const category = normalizeProgressCategory(query.category);
    const timeZone = systemTimeZone();
    const today = localDateInTimeZone(new Date(), timeZone)!;
    return <ProgressView
      range={range}
      category={category}
      taskHistory={getProgressTaskHistory()}
      today={today}
      timeZone={timeZone}
    />;
  }
  const content = sections[section];
  if (!content) notFound();

  return <section className="mx-auto flex min-h-[360px] w-full max-w-[1500px] flex-col justify-center"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em]">{content.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content.description}</p></div></section>;
}
