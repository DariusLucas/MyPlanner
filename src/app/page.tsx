import { DashboardView } from "@/src/components/dashboard-view";
import { getDashboardData } from "@/src/lib/supabase/planner";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  return <DashboardView data={await getDashboardData()} />;
}
