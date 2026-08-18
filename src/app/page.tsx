import { DashboardView } from "@/src/components/dashboard-view";
import { getDashboardData } from "@/src/lib/dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardView data={getDashboardData()} />;
}
