"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createCategory, deleteCategory, permanentlyDeleteCategory, updateCategory } from "@/src/app/category-actions";
import {
  categoryIconLabels,
  categoryIconNames,
  categoryIcons,
  categoryColorNames,
  categoryColors,
  type CategoryColorName,
  type CategoryIconName,
  type PlannerCategory,
} from "@/src/lib/categories";
import { useDialogContract } from "@/src/components/interaction-primitives";

export function CategoryDialog({ open, category, onClose, onDeleted }: {
  open: boolean;
  category?: PlannerCategory;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [icon, setIcon] = useState<CategoryIconName>(category?.icon ?? "target");
  const [color, setColor] = useState<CategoryColorName>(category?.color ?? "orange");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dialogRef = useDialogContract<HTMLFormElement>({ active: open, blocked: pending, onClose });

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setIcon(category?.icon ?? "target");
    setColor(category?.color ?? "orange");
    setConfirmDelete(false);
    setConfirmPermanentDelete(false);
    setError(null);
  }, [category, open]);

  if (!open) return null;

  function closeAnimated() {
    if (pending || closing) return;
    setClosing(true);
    window.setTimeout(onClose, 190);
  }

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const result = await (category ? updateCategory(form) : createCategory(form));
    setPending(false);
    if (!result.ok) return setError(result.error);
    closeAnimated();
    router.refresh();
  }

  async function remove(permanent = false) {
    if (!category) return;
    const form = new FormData();
    form.set("id", category.id);
    form.set("revision", String(category.revision));
    setPending(true);
    setError(null);
    const result = await (permanent ? permanentlyDeleteCategory(form) : deleteCategory(form));
    setPending(false);
    if (!result.ok) return setError(result.error);
    closeAnimated();
    onDeleted?.();
    router.refresh();
  }

  const dialog = (
    <div className={`modal-backdrop category-modal-backdrop ${closing ? "category-modal-closing" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAnimated()}>
      <form ref={dialogRef} tabIndex={-1} action={submit} className={`category-dialog ${closing ? "category-dialog-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="category-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="dashboard-eyebrow">Your spaces</p>
            <h2 id="category-dialog-title" className="mt-1 text-xl font-semibold tracking-[-.035em]">{category ? "Edit category" : "New category"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Give this part of your life a clear name and symbol.</p>
          </div>
          <button type="button" onClick={closeAnimated} disabled={pending} className="milestone-icon-button" aria-label="Close"><X size={17} /></button>
        </div>
        {category ? <><input type="hidden" name="id" value={category.id} /><input type="hidden" name="revision" value={category.revision} /></> : null}
        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Name</span>
          <input autoFocus name="name" defaultValue={category?.name ?? ""} maxLength={40} required placeholder="Gym, University, Family…" className="focus-input" />
        </label>
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Choose an icon</legend>
          <div className="category-icon-grid">
            {categoryIconNames.map((value) => {
              const Icon = categoryIcons[value];
              return <button type="button" key={value} title={categoryIconLabels[value]} aria-label={categoryIconLabels[value]} aria-pressed={icon === value} onClick={() => setIcon(value)} className="category-icon-option"><Icon size={19} /></button>;
            })}
          </div>
        </fieldset>
        <input type="hidden" name="icon" value={icon} />
        <fieldset className="mt-5"><legend className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Accent color</legend><div className="category-color-row">{categoryColorNames.map((value) => <button type="button" key={value} title={`${value} accent`} aria-label={`${value} accent`} aria-pressed={color === value} onClick={() => setColor(value)} className="category-color-option" style={{ "--category-color": categoryColors[value] } as CSSProperties}><span /></button>)}</div></fieldset>
        <input type="hidden" name="color" value={color} />
        {error ? <p className="mt-4 text-sm text-red-600" role="alert">{error}</p> : null}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            {category ? <div className="category-delete-confirm">{confirmDelete ? <span key="archive-confirm" className="category-delete-state-enter flex items-center gap-2"><span className="text-xs text-muted-foreground">Archive category?</span><button type="button" className="thought-quiet-button" disabled={pending} onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="entity-delete-button" disabled={pending} onClick={() => void remove()}>{pending ? "Archiving…" : "Archive"}</button></span> : confirmPermanentDelete ? <span key="permanent-confirm" className="category-delete-state-enter flex items-center gap-2"><span className="text-xs text-muted-foreground">Delete forever? Empty only.</span><button type="button" className="thought-quiet-button" disabled={pending} onClick={() => setConfirmPermanentDelete(false)}>Keep</button><button type="button" className="entity-delete-button" disabled={pending} onClick={() => void remove(true)}>{pending ? "Deleting…" : "Delete forever"}</button></span> : <span key="delete-actions" className="category-delete-state-enter flex flex-wrap items-center gap-1"><button type="button" className="thought-quiet-button text-red-600" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Archive category</button><button type="button" className="thought-quiet-button text-red-600" disabled={pending} onClick={() => setConfirmPermanentDelete(true)}>Delete permanently</button></span>}</div> : null}
          </div>
          <div className="flex gap-2"><button type="button" className="thought-quiet-button" disabled={pending} onClick={closeAnimated}>Cancel</button><button className="premium-small-button" disabled={pending}>{pending ? <><LoaderCircle size={14} className="animate-spin" /> Saving…</> : category ? "Save changes" : "Create category"}</button></div>
        </div>
        {category ? <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Archive hides this category while keeping its history. Permanent deletion is only allowed when it has no tasks, recurring tasks, or milestones.</p> : null}
      </form>
    </div>
  );

  // Keep the dialog outside the animated workspace surface so the modal
  // remains crisp while the underlying planner is intentionally blurred.
  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}
