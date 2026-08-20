import { z } from "zod";
import { changed, run } from "../database";
import type { ActionResult } from "./tasks";

const thoughtSchema = z.string().trim().min(1, "Write a thought first.").max(1200, "Keep thoughts under 1,200 characters.");
const idSchema = z.coerce.number().int().positive();
function value(form: FormData, key: string) { const entry = form.get(key); return typeof entry === "string" ? entry : ""; }
function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the thought and try again." };
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createThought(form: FormData): Promise<ActionResult> {
  const text = thoughtSchema.safeParse(value(form, "text"));
  if (!text.success) return failure(text.error);
  try {
    const now = new Date().toISOString();
    await run("INSERT INTO quick_thoughts(text, created_at, updated_at) VALUES (?, ?, ?)", [text.data, now, now]);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateThought(form: FormData): Promise<ActionResult> {
  const text = thoughtSchema.safeParse(value(form, "text"));
  const id = idSchema.safeParse(value(form, "id"));
  if (!text.success) return failure(text.error);
  if (!id.success) return failure(id.error);
  try {
    const result = await run("UPDATE quick_thoughts SET text = ?, updated_at = ? WHERE id = ?", [text.data, new Date().toISOString(), id.data]);
    return changed(result) ? { ok: true } : { ok: false, error: "That thought no longer exists." };
  } catch (error) { return failure(error); }
}

export async function deleteThought(form: FormData): Promise<ActionResult> {
  const id = idSchema.safeParse(value(form, "id"));
  if (!id.success) return failure(id.error);
  try {
    const result = await run("DELETE FROM quick_thoughts WHERE id = ?", [id.data]);
    return changed(result) ? { ok: true } : { ok: false, error: "That thought no longer exists." };
  } catch (error) { return failure(error); }
}
