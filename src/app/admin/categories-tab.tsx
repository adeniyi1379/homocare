"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Modal } from "@/components/modal";
import { Field, inputClass, Badge } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import {
  addCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export function CategoriesTab({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleToggle(c: CategoryRow) {
    setBusyId(c.id);
    setActionError(null);
    const res = await toggleCategoryActive(c.id, !c.active);
    setBusyId(null);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(c: CategoryRow) {
    if (!window.confirm(`Delete category "${c.name}"? Existing encounters keep their category label.`)) {
      return;
    }
    setBusyId(c.id);
    setActionError(null);
    const res = await deleteCategory(c.id);
    setBusyId(null);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-500">
          These categories appear in the reception &ldquo;Open Encounter&rdquo; form. Rename, reorder,
          switch on/off, or delete them. Encounter records keep their category label as text even
          after a category is deleted.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn btn-primary"
        >
          + Add Category
        </button>
      </div>

      {actionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-slate-500">No intake categories yet. Add one to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Order</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">In use</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-400">{c.sort_order}</td>
                  <td className="py-2 pr-3 font-medium text-slate-900">{c.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{c.description ?? "-"}</td>
                  <td className="py-2 pr-3">
                    {c.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500">Hidden</Badge>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(c)}
                        disabled={busyId === c.id}
                        className={`btn btn-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                          c.active
                            ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                            : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {busyId === c.id ? "..." : c.active ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        disabled={busyId === c.id}
                        className="btn btn-sm border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={adding} title="Add Intake Category" onClose={() => setAdding(false)}>
        <AddCategoryForm onDone={() => setAdding(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        title={editing ? `Edit ${editing.name}` : "Edit Category"}
        onClose={() => setEditing(null)}
      >
        {editing && <EditCategoryForm category={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function AddCategoryForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(addCategory, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !state?.error) onDone();
  }, [state, onDone]);

  return (
    <form
      action={(fd) => {
        submitted.current = true;
        action(fd);
      }}
      className="space-y-3"
    >
      <FormError message={state?.error} />
      <Field label="Name">
        <input name="name" required className={inputClass} placeholder="e.g. General Outpatient" />
      </Field>
      <Field label="Description">
        <input name="description" className={inputClass} placeholder="Short description (optional)" />
      </Field>
      <Field label="Display order">
        <input name="sort_order" type="number" min={0} className={inputClass} defaultValue={10} />
      </Field>
      <SubmitButton pendingLabel="Adding...">Add Category</SubmitButton>
    </form>
  );
}

function EditCategoryForm({ category, onDone }: { category: CategoryRow; onDone: () => void }) {
  const [state, action] = useActionState(updateCategory, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !state?.error) onDone();
  }, [state, onDone]);

  return (
    <form
      action={(fd) => {
        submitted.current = true;
        action(fd);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={category.id} />
      <FormError message={state?.error} />
      <Field label="Name">
        <input name="name" required className={inputClass} defaultValue={category.name} />
      </Field>
      <Field label="Description">
        <input
          name="description"
          className={inputClass}
          defaultValue={category.description ?? ""}
        />
      </Field>
      <Field label="Display order">
        <input
          name="sort_order"
          type="number"
          min={0}
          className={inputClass}
          defaultValue={category.sort_order}
        />
      </Field>
      <SubmitButton pendingLabel="Saving...">Save Changes</SubmitButton>
    </form>
  );
}