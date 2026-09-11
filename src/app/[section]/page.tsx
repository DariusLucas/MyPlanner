import { notFound } from "next/navigation";
import { FocusAreaView } from "@/src/components/focus-area-view";
import type { FocusArea } from "@/src/lib/focus-areas";
import { WeekView } from "@/src/components/week-view";
import { normalizeWeekStart } from "@/src/lib/planner-dates";
import { ProgressView } from "@/src/components/progress-view";
import { localDateInTimeZone, systemTimeZone } from "@/src/lib/progress";
import {
  getFocusAreaData,
  getProgressTaskHistory,
  getWeekData,
} from "@/src/lib/supabase/planner";
import { normalizeProgressCategory, normalizeProgressRange } from "@/src/lib/progress-visuals";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { signOut } from "@/src/app/auth-actions";
import { ThemeToggle } from "@/src/components/theme-toggle";
import { SettingsAccountCard } from "@/src/components/settings-account-card";

export const dynamic = "force-dynamic";

type SectionSearchParams = {
  week?: string | string[];
  range?: string | string[];
  category?: string | string[];
};

const sections: Record<string, { title: string; description: string }> = {
  settings: {
    title: "Profile",
    description: "Theme controls are available in the sidebar. Additional settings will be introduced only when they support an active workflow.",
  },
};

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SectionSearchParams> }) {
  const { section } = await params;
  const query = await searchParams;
  if (section === "week") {
    return <WeekView data={await getWeekData(normalizeWeekStart(query.week))} />;
  }
  if (section === "career" || section === "content") return <FocusAreaView data={await getFocusAreaData(section as FocusArea)} />;
  if (section === "progress") {
    const range = normalizeProgressRange(query.range);
    const category = normalizeProgressCategory(query.category);
    const timeZone = systemTimeZone();
    const today = localDateInTimeZone(new Date(), timeZone)!;
    return <ProgressView
      range={range}
      category={category}
      taskHistory={await getProgressTaskHistory()}
      today={today}
      timeZone={timeZone}
    />;
  }
  const content = sections[section];
  if (!content) notFound();
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : "Your Planner account";
  return (
    <section className="settings-shell mx-auto w-full max-w-[760px] space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-.055em]">{content.title}</h1>
      </header>
      <SettingsAccountCard email={email} signOutAction={signOut} />
      <article className="settings-preference-row">
        <div><h2 className="text-sm font-semibold">Appearance</h2><p className="mt-1 text-xs text-muted-foreground">Use a light, dark, or system-matched theme.</p></div>
        <ThemeToggle labelled />
      </article>
    </section>
  );
}
