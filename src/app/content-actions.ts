"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/src/app/today/actions";
import {
  createPlannerMilestone,
  deletePlannerMilestone,
  PlannerAuthError,
  PlannerDataError,
  setPlannerMilestoneAchieved,
  updatePlannerMilestone,
} from "@/src/lib/supabase/planner";

const categorySchema = z.string().uuid();
const targetSchema = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().positive(),
  category: categorySchema,
});
const milestoneSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Add a milestone name.")
    .max(160, "Keep the milestone under 160 characters."),
  type: z.string().trim().min(1, "Add a milestone type.").max(60, "Keep the type under 60 characters."),
  targetValue: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : Number(value)),
    z.number().int().positive("Use a positive target.").max(1_000_000_000).optional(),
  ),
});

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function fail(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Check the milestone and try again.",
    };
  }
  if (error instanceof PlannerAuthError || error instanceof PlannerDataError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh() {
  revalidatePath("/category", "layout");
  revalidatePath("/progress");
}

function parseMilestone(formData: FormData) {
  return milestoneSchema.safeParse({
    label: value(formData, "label"),
    type: value(formData, "type"),
    targetValue: value(formData, "targetValue"),
  });
}

function parseTarget(formData: FormData) {
  return targetSchema.safeParse({
    id: value(formData, "id"),
    revision: value(formData, "revision"),
    category: value(formData, "category"),
  });
}

export async function createMilestone(formData: FormData): Promise<ActionResult> {
  const parsed = parseMilestone(formData);
  const category = categorySchema.safeParse(value(formData, "category"));
  if (!parsed.success) return fail(parsed.error);
  if (!category.success) return fail(category.error);
  try {
    await createPlannerMilestone(category.data, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMilestone(formData: FormData): Promise<ActionResult> {
  const parsed = parseMilestone(formData);
  const target = parseTarget(formData);
  if (!parsed.success) return fail(parsed.error);
  if (!target.success) return fail(target.error);
  try {
    await updatePlannerMilestone(
      target.data.id,
      target.data.revision,
      target.data.category,
      parsed.data,
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleMilestone(formData: FormData): Promise<ActionResult> {
  const target = parseTarget(formData);
  const achieved = z.enum(["true", "false"]).safeParse(value(formData, "achieved"));
  if (!target.success) return fail(target.error);
  if (!achieved.success) return fail(achieved.error);
  try {
    await setPlannerMilestoneAchieved(
      target.data.id,
      target.data.revision,
      target.data.category,
      achieved.data === "true",
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMilestone(formData: FormData): Promise<ActionResult> {
  const target = parseTarget(formData);
  if (!target.success) return fail(target.error);
  try {
    await deletePlannerMilestone(
      target.data.id,
      target.data.revision,
      target.data.category,
    );
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
