import { notFound, redirect } from "next/navigation";
import { WeekView } from "@/src/components/week-view";
import { normalizeWeekStart } from "@/src/lib/planner-dates";
import { ProgressView } from "@/src/components/progress-view";
import { localDateInTimeZone, systemTimeZone } from "@/src/lib/progress";
import {
  getPlannerCategories,
  getProgressTaskHistory,
  getWeekData,
} from "@/src/lib/supabase/planner";
import { ArchivedCategories } from "@/src/components/archived-categories";
import { normalizeProgressCategories, normalizeProgressRange } from "@/src/lib/progress-visuals";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { signOut } from "@/src/app/auth-actions";
import { ThemeToggle } from "@/src/components/theme-toggle";
import { SettingsAccountCard } from "@/src/components/settings-account-card";

export const dynamic = "force-dynamic";

type SectionSearchParams = {
  week?: string | string[];
  range?: string | string[];
  category?: string | string[];
  categories?: string | string[];
};

const sections: Record<string, { title: string; description: string }> = {
  account: {
    title: "Account",
    description: "Theme controls are available in the sidebar. Additional settings will be introduced only when they support an active workflow.",
  },
};

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<SectionSearchParams> }) {
  const { section } = await params;
  const query = await searchParams;
  if (section === "settings") redirect("/account");
  if (section === "week") {
    return <WeekView data={await getWeekData(normalizeWeekStart(query.week))} />;
  }
  if (section === "career" || section === "content") {
    const category = (await getPlannerCategories()).find((item) => item.name.toLowerCase() === section);
    if (category) redirect(`/category/${category.id}`);
    notFound();
  }
  if (section === "progress") {
    const range = normalizeProgressRange(query.range);
    const categories = await getPlannerCategories();
    const selectedCategories = normalizeProgressCategories(query.categories ?? query.category).filter((id) => categories.some((category) => category.id === id));
    const timeZone = systemTimeZone();
    const today = localDateInTimeZone(new Date(), timeZone)!;
    return <ProgressView
      range={range}
      categories={categories}
      selectedCategories={selectedCategories}
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
  const archivedCategories = await getPlannerCategories({ includeArchived: true });
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
      <ArchivedCategories categories={archivedCategories.filter((category) => category.archivedAt)} />
    </section>
  );
}
