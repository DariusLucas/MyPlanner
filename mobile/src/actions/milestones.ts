import { z } from "zod";
import { createPlannerMilestone, deletePlannerMilestone, setPlannerMilestoneAchieved, updatePlannerMilestone } from "../repository";
import { MobileAuthError, MobileDataError } from "../supabase";
import type { ActionResult } from "./tasks";

const idSchema = z.string().uuid();
const categorySchema = z.string().uuid();
const milestoneSchema = z.object({
  label: z.string().trim().min(1, "Add a milestone name.").max(160, "Keep the milestone under 160 characters."),
  type: z.enum(["views", "likes", "followers", "applications", "interviews", "offers", "custom"]),
  targetValue: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : Number(value),
    z.number().int().positive("Use a positive target.").max(1_000_000_000).optional(),
  ),
});
function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry : ""; }
function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the milestone and try again." };
  if (error instanceof MobileAuthError || error instanceof MobileDataError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createMilestone(form: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(form, "label"), type: value(form, "type"), targetValue: value(form, "targetValue") });
  const category = categorySchema.safeParse(value(form, "category"));
  if (!parsed.success) return failure(parsed.error);
  if (!category.success) return failure(category.error);
  try {
    await createPlannerMilestone(category.data, parsed.data);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateMilestone(form: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(form, "label"), type: value(form, "type"), targetValue: value(form, "targetValue") });
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  const revision = z.coerce.number().int().positive().safeParse(value(form, "revision"));
  if (!parsed.success) return failure(parsed.error);
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  if (!revision.success) return failure(revision.error);
  try {
    await updatePlannerMilestone(id.data, revision.data, category.data, parsed.data);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function toggleMilestone(form: FormData): Promise<ActionResult> {
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  const achieved = z.enum(["true", "false"]).safeParse(value(form, "achieved"));
  const revision = z.coerce.number().int().positive().safeParse(value(form, "revision"));
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  if (!achieved.success) return failure(achieved.error);
  if (!revision.success) return failure(revision.error);
  try {
    await setPlannerMilestoneAchieved(id.data, revision.data, category.data, achieved.data === "true");
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function deleteMilestone(form: FormData): Promise<ActionResult> {
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  const revision = z.coerce.number().int().positive().safeParse(value(form, "revision"));
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  if (!revision.success) return failure(revision.error);
  try {
    await deletePlannerMilestone(id.data, revision.data, category.data);
    return { ok: true };
  } catch (error) { return failure(error); }
}
