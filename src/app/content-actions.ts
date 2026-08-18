"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/src/app/today/actions";
import { createFocusMilestone, deleteFocusMilestone, setFocusMilestoneAchieved, updateFocusMilestone } from "@/src/lib/focus-areas";

const idSchema = z.coerce.number().int().positive();
const categorySchema = z.enum(["career", "content"]);
const milestoneSchema = z.object({
  label: z.string().trim().min(1, "Add a milestone name.").max(160, "Keep the milestone under 160 characters."),
  type: z.enum(["views", "likes", "followers", "applications", "interviews", "offers", "custom"]),
  targetValue: z.preprocess((value) => value === "" || value === undefined ? undefined : Number(value), z.number().int().positive("Use a positive target.").max(1_000_000_000).optional()),
});

function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry : ""; }
function fail(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the milestone and try again." };
  return { ok: false, error: "Something went wrong. Please try again." };
}
function refresh() { revalidatePath("/career"); revalidatePath("/content"); }

export async function createMilestone(formData: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(formData, "label"), type: value(formData, "type"), targetValue: value(formData, "targetValue") });
  const category = categorySchema.safeParse(value(formData, "category"));
  if (!parsed.success) return fail(parsed.error);
  if (!category.success) return fail(category.error);
  try { createFocusMilestone(category.data, parsed.data); refresh(); return { ok: true }; } catch (error) { return fail(error); }
}

export async function updateMilestone(formData: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(formData, "label"), type: value(formData, "type"), targetValue: value(formData, "targetValue") });
  const id = idSchema.safeParse(value(formData, "id"));
  const category = categorySchema.safeParse(value(formData, "category"));
  if (!parsed.success) return fail(parsed.error);
  if (!id.success) return fail(id.error);
  if (!category.success) return fail(category.error);
  try { if (!updateFocusMilestone(id.data, category.data, parsed.data)) return { ok: false, error: "That milestone no longer exists." }; refresh(); return { ok: true }; } catch (error) { return fail(error); }
}

export async function toggleMilestone(formData: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(formData, "id"));
  const category = categorySchema.safeParse(value(formData, "category"));
  const achieved = z.enum(["true", "false"]).safeParse(value(formData, "achieved"));
  if (!id.success) return fail(id.error);
  if (!category.success) return fail(category.error);
  if (!achieved.success) return fail(achieved.error);
  try { if (!setFocusMilestoneAchieved(id.data, category.data, achieved.data === "true")) return { ok: false, error: "That milestone no longer exists." }; refresh(); return { ok: true }; } catch (error) { return fail(error); }
}

export async function deleteMilestone(formData: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(formData, "id"));
  const category = categorySchema.safeParse(value(formData, "category"));
  if (!id.success) return fail(id.error);
  if (!category.success) return fail(category.error);
  try { if (!deleteFocusMilestone(id.data, category.data)) return { ok: false, error: "That milestone no longer exists." }; refresh(); return { ok: true }; } catch (error) { return fail(error); }
}
