import { TodayView } from "@/src/components/today-view";
import { getTodayData, normalizeDateValue } from "@/src/lib/today";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const params = await searchParams;
  const date = normalizeDateValue(params.date);
  return <TodayView data={getTodayData(date)} />;
}
