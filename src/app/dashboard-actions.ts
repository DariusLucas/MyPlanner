"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/src/app/today/actions";
import {
  createPlannerThought,
  deletePlannerThought,
  PlannerAuthError,
  PlannerDataError,
  updatePlannerThought,
} from "@/src/lib/supabase/planner";

const thoughtSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write a thought first.")
    .max(1200, "Keep thoughts under 1,200 characters."),
});
const targetSchema = z.object({
  id: z.string().uuid(),
  revision: z.coerce.number().int().positive(),
});

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function errorResult(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Check the thought and try again.",
    };
  }
  if (error instanceof PlannerAuthError || error instanceof PlannerDataError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createThought(form: FormData): Promise<ActionResult> {
  const parsed = thoughtSchema.safeParse({ text: value(form, "text") });
  if (!parsed.success) return errorResult(parsed.error);
  try {
    await createPlannerThought(parsed.data.text);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateThought(form: FormData): Promise<ActionResult> {
  const parsed = thoughtSchema.safeParse({ text: value(form, "text") });
  const target = targetSchema.safeParse({
    id: value(form, "id"),
    revision: value(form, "revision"),
  });
  if (!parsed.success) return errorResult(parsed.error);
  if (!target.success) return errorResult(target.error);
  try {
    await updatePlannerThought(
      target.data.id,
      target.data.revision,
      parsed.data.text,
    );
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteThought(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({
    id: value(form, "id"),
    revision: value(form, "revision"),
  });
  if (!target.success) return errorResult(target.error);
  try {
    await deletePlannerThought(target.data.id, target.data.revision);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}
