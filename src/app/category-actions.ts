"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoryColorNames, categoryIconNames } from "@/src/lib/categories";
import {
  archivePlannerCategory,
  deletePlannerCategoryPermanently,
  createPlannerCategory,
  PlannerAuthError,
  PlannerDataError,
  updatePlannerCategory,
  restorePlannerCategory,
} from "@/src/lib/supabase/planner";
import type { ActionResult } from "@/src/app/today/actions";

const iconSchema = z.enum(categoryIconNames);
const categorySchema = z.object({
  name: z.string().trim().min(1, "Give your category a name.").max(40, "Keep the name under 40 characters."),
  icon: iconSchema,
  color: z.enum(categoryColorNames),
});
const targetSchema = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().positive(),
});

function value(form: FormData, key: string) {
  const item = form.get(key);
  return typeof item === "string" ? item : "";
}

function result(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the category and try again." };
  if (error instanceof PlannerAuthError || error instanceof PlannerDataError) return { ok: false, error: error.message };
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/progress");
}

export async function createCategory(form: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name: value(form, "name"), icon: value(form, "icon"), color: value(form, "color") });
  if (!parsed.success) return result(parsed.error);
  try {
    await createPlannerCategory(parsed.data.name, parsed.data.icon, parsed.data.color);
    refresh();
    return { ok: true };
  } catch (error) {
    return result(error);
  }
}

export async function updateCategory(form: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name: value(form, "name"), icon: value(form, "icon"), color: value(form, "color") });
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!parsed.success) return result(parsed.error);
  if (!target.success) return result(target.error);
  try {
    await updatePlannerCategory(target.data.id, target.data.revision, parsed.data.name, parsed.data.icon, parsed.data.color);
    refresh();
    return { ok: true };
  } catch (error) {
    return result(error);
  }
}

export async function deleteCategory(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!target.success) return result(target.error);
  try {
    await archivePlannerCategory(target.data.id, target.data.revision);
    refresh();
    return { ok: true };
  } catch (error) {
    return result(error);
  }
}

export async function permanentlyDeleteCategory(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!target.success) return result(target.error);
  try {
    await deletePlannerCategoryPermanently(target.data.id, target.data.revision);
    refresh();
    return { ok: true };
  } catch (error) {
    return result(error);
  }
}

export async function unarchiveCategory(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!target.success) return result(target.error);
  try {
    await restorePlannerCategory(target.data.id, target.data.revision);
    refresh();
    return { ok: true };
  } catch (error) {
    return result(error);
  }
}
