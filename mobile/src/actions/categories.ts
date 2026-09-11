import { z } from "zod";
import type { ActionResult } from "./tasks";
import { categoryIconNames } from "@/src/lib/categories";
import { mobileSupabase, requireMobileSession } from "../supabase";

const valuesSchema = z.object({ name: z.string().trim().min(1, "Give your category a name.").max(40), icon: z.enum(categoryIconNames) });
const targetSchema = z.object({ id: z.string().uuid(), revision: z.coerce.number().int().positive() });
const value = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
const failure = (error: unknown): ActionResult => ({ ok: false, error: error instanceof Error ? error.message : "Something went wrong. Please try again." });

export async function createCategory(form: FormData): Promise<ActionResult> {
  const parsed = valuesSchema.safeParse({ name: value(form, "name"), icon: value(form, "icon") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the category." };
  try {
    const session = await requireMobileSession();
    const { data: last, error: positionError } = await mobileSupabase.from("categories").select("position").is("archived_at", null).order("position", { ascending: false }).limit(1).maybeSingle();
    if (positionError) throw positionError;
    const { error } = await mobileSupabase.from("categories").insert({ user_id: session.user.id, name: parsed.data.name, icon: parsed.data.icon, position: (last?.position ?? -1) + 1 });
    if (error) throw new Error(error.code === "23505" ? "You already have a category with that name." : error.message);
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function updateCategory(form: FormData): Promise<ActionResult> {
  const parsed = valuesSchema.safeParse({ name: value(form, "name"), icon: value(form, "icon") });
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!parsed.success || !target.success) return { ok: false, error: "Check the category and try again." };
  try {
    await requireMobileSession();
    const { data, error } = await mobileSupabase.from("categories").update(parsed.data).eq("id", target.data.id).eq("revision", target.data.revision).is("archived_at", null).select("id").maybeSingle();
    if (error) throw new Error(error.code === "23505" ? "You already have a category with that name." : error.message);
    if (!data) throw new Error("This category changed in another session. Refresh and try again.");
    return { ok: true };
  } catch (error) { return failure(error); }
}

export async function deleteCategory(form: FormData): Promise<ActionResult> {
  const target = targetSchema.safeParse({ id: value(form, "id"), revision: value(form, "revision") });
  if (!target.success) return { ok: false, error: "Refresh and try again." };
  try {
    await requireMobileSession();
    const { data, error } = await mobileSupabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", target.data.id).eq("revision", target.data.revision).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This category changed in another session. Refresh and try again.");
    return { ok: true };
  } catch (error) { return failure(error); }
}
