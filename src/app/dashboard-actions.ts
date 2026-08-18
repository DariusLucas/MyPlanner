"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/src/db/client";
import { quickThoughts } from "@/src/db/schema";
import type { ActionResult } from "@/src/app/today/actions";

const thoughtSchema = z.object({
  text: z.string().trim().min(1, "Write a thought first.").max(1200, "Keep thoughts under 1,200 characters."),
});
const idSchema = z.coerce.number().int().positive();

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function errorResult(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the thought and try again." };
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh() {
  revalidatePath("/");
}

export async function createThought(form: FormData): Promise<ActionResult> {
  const parsed = thoughtSchema.safeParse({ text: value(form, "text") });
  if (!parsed.success) return errorResult(parsed.error);
  try {
    const now = new Date().toISOString();
    db.insert(quickThoughts).values({ text: parsed.data.text, createdAt: now, updatedAt: now }).run();
    refresh();
    return { ok: true };
  } catch (error) { return errorResult(error); }
}

export async function updateThought(form: FormData): Promise<ActionResult> {
  const parsed = thoughtSchema.safeParse({ text: value(form, "text") });
  const id = idSchema.safeParse(value(form, "id"));
  if (!parsed.success) return errorResult(parsed.error);
  if (!id.success) return errorResult(id.error);
  try {
    const result = db.update(quickThoughts).set({ text: parsed.data.text, updatedAt: new Date().toISOString() }).where(eq(quickThoughts.id, id.data)).run();
    if (!result.changes) return { ok: false, error: "That thought no longer exists." };
    refresh();
    return { ok: true };
  } catch (error) { return errorResult(error); }
}

export async function deleteThought(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return errorResult(id.error);
  try {
    const result = db.delete(quickThoughts).where(eq(quickThoughts.id, id.data)).run();
    if (!result.changes) return { ok: false, error: "That thought no longer exists." };
    refresh();
    return { ok: true };
  } catch (error) { return errorResult(error); }
}
