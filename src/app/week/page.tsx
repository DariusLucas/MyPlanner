import { WeekView } from "@/src/components/week-view";
import { getWeekData, normalizeWeekStart } from "@/src/lib/week";

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const params = await searchParams;
  const weekStart = normalizeWeekStart(params.week);
  return <WeekView data={getWeekData(weekStart)} />;
}
