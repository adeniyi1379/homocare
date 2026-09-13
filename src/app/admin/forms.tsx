"use client";

import { useActionState } from "react";
import { setRole } from "./actions";
import { selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";

export function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const [state, action] = useActionState(setRole, undefined);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <FormError message={state?.error} />
      <select
        name="role"
        className={`${selectClass} w-auto`}
        defaultValue={currentRole}
      >
        <option value="receptionist">Receptionist</option>
        <option value="nurse">Nurse</option>
        <option value="pharmacy">Pharmacy</option>
        <option value="cashier">Cashier</option>
        <option value="admin">Admin</option>
      </select>
      <SubmitButton
        pendingLabel="..."
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
      >
        Save
      </SubmitButton>
    </form>
  );
}