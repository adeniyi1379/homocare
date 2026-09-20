"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Modal } from "@/components/modal";
import { Field, inputClass, selectClass, Badge, Card } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { formatDateTime } from "@/lib/utils";
import {
  createBranch,
  updateBranch,
  toggleBranchActive,
  setStaffBranch,
} from "./actions";

export type BranchRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
};

export type StaffWithBranchRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  created_at: string;
};

export function BranchesTab({
  branches,
  staff,
}: {
  branches: BranchRow[];
  staff: StaffWithBranchRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleToggle(b: BranchRow) {
    setBusyId(b.id);
    setActionError(null);
    const res = await toggleBranchActive(b.id, !b.active);
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
          Manage locations, then assign each staff member to the branch they operate from. Staff
          with no branch see and work with legacy, unassigned records.
        </p>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">
          + Create Branch
        </button>
      </div>

      {actionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {branches.length === 0 ? (
        <p className="text-sm text-slate-500">No branches yet.</p>
      ) : (
        <div className="space-y-6">
          {branches.map((b) => {
            const members = staff.filter((s) => s.branch_id === b.id);
            return (
              <div
                key={b.id}
                className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium text-slate-900">{b.name}</span>
                      <span className="ml-2 font-mono text-xs text-brand-600">{b.code}</span>
                    </div>
                    {b.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(b)}
                      className="btn btn-ghost btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(b)}
                      disabled={busyId === b.id}
                      className={`btn btn-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                        b.active
                          ? "border border-red-200 text-red-600 hover:bg-red-50"
                          : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {busyId === b.id ? "..." : b.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50/60 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {members.length} staff member{members.length === 1 ? "" : "s"}
                  </p>
                  {members.length === 0 ? (
                    <p className="text-sm text-slate-400">No staff assigned to this branch.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                        >
                          {s.full_name ?? "Unnamed"}
                          <span className="ml-2 text-xs capitalize text-slate-400">{s.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card title="Assign staff to branches" className="mt-6">
        {staff.length === 0 ? (
          <p className="text-sm text-slate-500">No staff accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 font-medium">Branch</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <MemberBranchRow
                    key={s.id}
                    member={s}
                    branches={branches}
                    onChanged={() => {
                      setActionError(null);
                      router.refresh();
                    }}
                    onError={(error) => setActionError(error)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={creating}
        title="Create Branch"
        onClose={() => setCreating(false)}
      >
        <CreateBranchForm onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        title={editing ? `Edit ${editing.name}` : "Edit Branch"}
        onClose={() => setEditing(null)}
      >
        {editing && <EditBranchForm branch={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function MemberBranchRow({
  member,
  branches,
  onChanged,
  onError,
}: {
  member: StaffWithBranchRow;
  branches: BranchRow[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSet(branchId: string) {
    setSaving(true);
    const res = await setStaffBranch(member.id, branchId || null);
    setSaving(false);
    if (res.error) {
      onError(res.error);
      return;
    }
    onChanged();
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3 font-medium text-slate-900">{member.full_name ?? "Unnamed"}</td>
      <td className="py-2 pr-3 text-slate-600">{member.email}</td>
      <td className="py-2 pr-3 capitalize text-slate-600">
        <Badge className="bg-slate-100 text-slate-600">{member.role}</Badge>
      </td>
      <td className="py-2">
        <select
          className={selectClass}
          value={member.branch_id ?? ""}
          disabled={saving}
          onChange={(e) => handleSet(e.target.value)}
        >
          <option value="">No branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function CreateBranchForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(createBranch, undefined);
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
      <Field label="Branch name">
        <input name="name" required className={inputClass} placeholder="e.g. Eastside Clinic" />
      </Field>
      <Field label="Branch code">
        <input name="code" required className={inputClass} placeholder="e.g. EAST" />
      </Field>
      <SubmitButton pendingLabel="Creating...">Create Branch</SubmitButton>
    </form>
  );
}

function EditBranchForm({ branch, onDone }: { branch: BranchRow; onDone: () => void }) {
  const [state, action] = useActionState(updateBranch, undefined);
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
      <input type="hidden" name="id" value={branch.id} />
      <FormError message={state?.error} />
      <Field label="Branch name">
        <input name="name" required className={inputClass} defaultValue={branch.name} />
      </Field>
      <Field label="Branch code">
        <input name="code" required className={inputClass} defaultValue={branch.code} />
      </Field>
      <SubmitButton pendingLabel="Saving...">Save Changes</SubmitButton>
    </form>
  );
}
