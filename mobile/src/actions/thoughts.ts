import { z } from "zod";
import { createPlannerThought, deletePlannerThought, updatePlannerThought } from "../repository";
import { MobileAuthError, MobileDataError } from "../supabase";
import type { ActionResult } from "./tasks";

const thoughtSchema = z.string().trim().min(1, "Write a thought first.").max(1200, "Keep thoughts under 1,200 characters.");
const targetSchema = z.object({ id: z.string().uuid(), revision: z.coerce.number().int().positive() });
function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry : ""; }
function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the thought and try again." };
  if (error instanceof MobileAuthError || error instanceof MobileDataError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createThought(form: FormData): Promise<ActionResult> {
  const text = thoughtSchema.safeParse(value(form, "text"));
  if (!text.success) return failure(text.error);
  try {
    await createPlannerThought(text.data);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateThought(form: FormData): Promise<ActionResult> {
  const text = thoughtSchema.safeParse(value(form, "text"));
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!text.success) return failure(text.error);
  if (!target.success) return failure(target.error);
  try {
    await updatePlannerThought(target.data.id, target.data.revision, text.data);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function deleteThought(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!target.success) return failure(target.error);
  try {
    await deletePlannerThought(target.data.id, target.data.revision);
    return { ok: true };
  } catch (error) { return failure(error); }
}
