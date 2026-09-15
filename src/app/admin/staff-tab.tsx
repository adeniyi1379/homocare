"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Modal } from "@/components/modal";
import { Field, inputClass, selectClass, Badge } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import {
  createStaff,
  updateStaff,
  resetStaffPassword,
  toggleStaffActive,
} from "./actions";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}));

export function StaffTab({ users }: { users: StaffRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleToggle(u: StaffRow) {
    setBusyId(u.id);
    setToggleError(null);
    const res = await toggleStaffActive(u.id, !u.is_active);
    setBusyId(null);
    if (res.error) {
      setToggleError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Create staff accounts, assign their role, reactivate or deactivate logins, and reset
          passwords. Deactivated staff cannot sign in but their records stay intact.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn btn-primary"
        >
          + Create Staff
        </button>
      </div>

      {toggleError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {toggleError}
        </div>
      )}

      {users.length === 0 ? (
        <p className="text-sm text-slate-500">No staff accounts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {u.full_name ?? "Unnamed staff"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{u.email}</td>
                  <td className="py-2 pr-3 capitalize text-slate-600">
                    <Badge tone="info">{u.role}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {u.is_active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Inactive</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{formatDateTime(u.created_at)}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetting(u)}
                        className="btn btn-ghost btn-sm"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(u)}
                        disabled={busyId === u.id}
                        className={`btn btn-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                          u.is_active
                            ? "border border-red-200 text-red-600 hover:bg-red-50"
                            : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {busyId === u.id ? "..." : u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} title="Create Staff Account" onClose={() => setCreating(false)}>
        <CreateStaffForm onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        open={editing !== null}
        title={editing ? `Edit ${editing.full_name ?? "staff"}` : "Edit Staff"}
        onClose={() => setEditing(null)}
      >
        {editing && <EditStaffForm user={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <Modal
        open={resetting !== null}
        title={resetting ? `Reset password · ${resetting.full_name ?? "staff"}` : "Reset password"}
        onClose={() => setResetting(null)}
      >
        {resetting && <ResetPasswordForm user={resetting} onDone={() => setResetting(null)} />}
      </Modal>
    </div>
  );
}

function CreateStaffForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(createStaff, undefined);
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
      <Field label="Full name">
        <input name="full_name" required className={inputClass} placeholder="e.g. Nurse Amina Bello" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} placeholder="name@hospital.org" />
      </Field>
      <Field label="Role">
        <select name="role" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select role...
          </option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Temporary password">
        <input
          name="password"
          type="text"
          required
          minLength={8}
          className={inputClass}
          placeholder="At least 8 characters"
        />
      </Field>
      <SubmitButton pendingLabel="Creating...">Create Account</SubmitButton>
    </form>
  );
}

function EditStaffForm({ user, onDone }: { user: StaffRow; onDone: () => void }) {
  const [state, action] = useActionState(updateStaff, undefined);
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
      <input type="hidden" name="user_id" value={user.id} />
      <FormError message={state?.error} />
      <Field label="Full name">
        <input
          name="full_name"
          required
          className={inputClass}
          defaultValue={user.full_name ?? ""}
        />
      </Field>
      <Field label="Role">
        <select name="role" className={selectClass} defaultValue={user.role}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pendingLabel="Saving...">Save Changes</SubmitButton>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: StaffRow; onDone: () => void }) {
  const [state, action] = useActionState(resetStaffPassword, undefined);
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
      <input type="hidden" name="user_id" value={user.id} />
      <FormError message={state?.error} />
      <p className="text-xs text-slate-500">
        Set a new password for <span className="font-semibold">{user.email}</span>. Give it to the
        staff member in person.
      </p>
      <Field label="New password">
        <input
          name="password"
          type="text"
          required
          minLength={8}
          className={inputClass}
          placeholder="At least 8 characters"
        />
      </Field>
      <SubmitButton pendingLabel="Updating...">Set Password</SubmitButton>
    </form>
  );
}