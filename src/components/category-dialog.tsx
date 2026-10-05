"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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
import { ConfirmationDialog, useDialogContract } from "@/src/components/interaction-primitives";

export function CategoryDialog({ open, category, onClose, onDeleted }: {
  open: boolean;
  category?: PlannerCategory;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [icon, setIcon] = useState<CategoryIconName>(category?.icon ?? "target");
  const [color, setColor] = useState<CategoryColorName>(category?.color ?? "orange");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<"archive" | "permanent-delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dialogRef = useDialogContract<HTMLFormElement>({ active: open, blocked: pending, onClose });

  useEffect(() => {
    if (!open) return;
    setClosing(false);
    setIcon(category?.icon ?? "target");
    setColor(category?.color ?? "orange");
    setConfirmation(null);
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
    if (pathname === `/category/${category.id}`) router.push("/");
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
          <input name="name" defaultValue={category?.name ?? ""} maxLength={40} required placeholder="Gym, University, Family…" className="focus-input" />
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
        <div className={`category-dialog-action-row ${category ? "category-dialog-action-row-has-danger" : ""}`}>
          {category ? <div className="category-dialog-danger-zone"><div className="category-dialog-danger-actions"><button type="button" className="thought-quiet-button text-red-600" disabled={pending} onClick={() => setConfirmation("archive")}>Archive category</button><button type="button" className="thought-quiet-button text-red-600" disabled={pending} onClick={() => setConfirmation("permanent-delete")}><Trash2 size={14} /> Delete permanently</button></div></div> : null}
          <div className="category-dialog-footer"><button type="button" className="thought-quiet-button" disabled={pending} onClick={closeAnimated}>Cancel</button><button className="premium-small-button" disabled={pending}>{pending ? <><LoaderCircle size={14} className="animate-spin" /> Saving…</> : category ? "Save changes" : "Create category"}</button></div>
        </div>
      </form>
      <ConfirmationDialog
        open={confirmation !== null}
        title={confirmation === "archive" ? `Archive “${category?.name ?? "category"}”?` : `Delete “${category?.name ?? "category"}” forever?`}
        description={confirmation === "archive"
          ? "This category will be hidden from your planner. Its tasks and progress will be kept, and you can restore it later."
          : "This permanently removes an empty category. Categories with tasks, recurrences, or milestones cannot be deleted."}
        confirmLabel={confirmation === "archive" ? "Archive category" : "Delete permanently"}
        pending={pending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { const permanent = confirmation === "permanent-delete"; setConfirmation(null); return remove(permanent); }}
      />
    </div>
  );

  // Keep the dialog outside the animated workspace surface so the modal
  // remains crisp while the underlying planner is intentionally blurred.
  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}
