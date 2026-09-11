import { notFound } from "next/navigation";
import { FocusAreaView } from "@/src/components/focus-area-view";
import { getFocusAreaData, getPlannerCategory } from "@/src/lib/supabase/planner";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const category = await getPlannerCategory(categoryId);
  if (!category) notFound();
  return <FocusAreaView data={await getFocusAreaData(category)} />;
}
