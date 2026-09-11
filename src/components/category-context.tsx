"use client";

import { createContext, useContext } from "react";
import type { PlannerCategory } from "@/src/lib/categories";

const CategoryContext = createContext<PlannerCategory[]>([]);

export function CategoryProvider({ categories, children }: { categories: PlannerCategory[]; children: React.ReactNode }) {
  return <CategoryContext.Provider value={categories}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  return useContext(CategoryContext);
}
