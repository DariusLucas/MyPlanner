import { z } from "zod";
import { changed, run } from "../database";
import type { ActionResult } from "./tasks";

const idSchema = z.coerce.number().int().positive();
const categorySchema = z.enum(["career", "content"]);
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
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createMilestone(form: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(form, "label"), type: value(form, "type"), targetValue: value(form, "targetValue") });
  const category = categorySchema.safeParse(value(form, "category"));
  if (!parsed.success) return failure(parsed.error);
  if (!category.success) return failure(category.error);
  try {
    const now = new Date().toISOString();
    await run(
      "INSERT INTO content_milestones(category, label, type, target_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [category.data, parsed.data.label, parsed.data.type, parsed.data.targetValue ?? null, now, now],
    );
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateMilestone(form: FormData): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse({ label: value(form, "label"), type: value(form, "type"), targetValue: value(form, "targetValue") });
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  if (!parsed.success) return failure(parsed.error);
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  try {
    const result = await run(
      "UPDATE content_milestones SET label = ?, type = ?, target_value = ?, updated_at = ? WHERE id = ? AND category = ?",
      [parsed.data.label, parsed.data.type, parsed.data.targetValue ?? null, new Date().toISOString(), id.data, category.data],
    );
    return changed(result) ? { ok: true } : { ok: false, error: "That milestone no longer exists." };
  } catch (error) { return failure(error); }
}

export async function toggleMilestone(form: FormData): Promise<ActionResult> {
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  const achieved = z.enum(["true", "false"]).safeParse(value(form, "achieved"));
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  if (!achieved.success) return failure(achieved.error);
  try {
    const now = new Date().toISOString();
    const result = await run(
      "UPDATE content_milestones SET achieved_at = ?, updated_at = ? WHERE id = ? AND category = ?",
      [achieved.data === "true" ? now : null, now, id.data, category.data],
    );
    return changed(result) ? { ok: true } : { ok: false, error: "That milestone no longer exists." };
  } catch (error) { return failure(error); }
}

export async function deleteMilestone(form: FormData): Promise<ActionResult> {
  const category = categorySchema.safeParse(value(form, "category"));
  const id = idSchema.safeParse(value(form, "id"));
  if (!category.success) return failure(category.error);
  if (!id.success) return failure(id.error);
  try {
    const result = await run("DELETE FROM content_milestones WHERE id = ? AND category = ?", [id.data, category.data]);
    return changed(result) ? { ok: true } : { ok: false, error: "That milestone no longer exists." };
  } catch (error) { return failure(error); }
}
