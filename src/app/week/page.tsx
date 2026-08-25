import { WeekView } from "@/src/components/week-view";
import { normalizeWeekStart } from "@/src/lib/planner-dates";
import { getWeekData } from "@/src/lib/supabase/planner";

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const params = await searchParams;
  const weekStart = normalizeWeekStart(params.week);
  return <WeekView data={await getWeekData(weekStart)} />;
}
