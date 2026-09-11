"use client";

import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { unarchiveCategory } from "@/src/app/category-actions";
import { categoryIcon, categoryColors, type PlannerCategory } from "@/src/lib/categories";

export function ArchivedCategories({ categories }: { categories: PlannerCategory[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (!categories.length) return null;
  function restore(category: PlannerCategory) {
    const form = new FormData();
    form.set("id", category.id);
    form.set("revision", String(category.revision));
    setPendingId(category.id);
    startTransition(async () => {
      await unarchiveCategory(form);
      setPendingId(null);
    });
  }
  return <article className="settings-archived-categories"><div><p className="settings-account-kicker">Category history</p><h2 className="mt-1 text-lg font-semibold">Archived categories</h2><p className="mt-1 text-xs text-muted-foreground">Bring a past category back whenever you need it. Its tasks and progress are still safe.</p></div><div className="settings-archived-list">{categories.map((category) => { const Icon = categoryIcon(category.icon); const pending = pendingId === category.id; return <div className="settings-archived-row" key={category.id}><span className="settings-archived-icon" style={{ color: categoryColors[category.color] }}><Icon size={17} /></span><div className="min-w-0 flex-1"><strong>{category.name}</strong><small>Archived category</small></div><button type="button" disabled={pendingId !== null} onClick={() => restore(category)} className="settings-restore-button">{pending ? <LoaderCircle size={14} className="animate-spin" /> : <ArchiveRestore size={14} />} {pending ? "Restoring…" : "Unarchive"}</button></div>; })}</div></article>;
}
