"use client";

import { useActionState } from "react";
import { setFee, recordPayment } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { encounterLabel, formatNaira } from "@/lib/utils";

export type LedgerTreatment = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number | null;
  total_paid: number;
  balance_remaining: number;
  payment_status: string;
};

export function SetFeeForm({ treatments }: { treatments: LedgerTreatment[] }) {
  const [state, action] = useActionState(setFee, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select treatment...
          </option>
          {treatments.map((r) => (
            <option key={r.treatment_id} value={r.treatment_id}>
              {r.patient_code} - {r.patient_name} ({encounterLabel(r.encounter_type)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Total treatment fee (₦)">
        <input
          name="total_treatment_fee"
          type="number"
          step="0.01"
          min="0"
          required
          className={inputClass}
          placeholder="e.g. 5000"
        />
      </Field>
      <p className="text-xs text-slate-400">
        This is the single manual fee repaid by the patient; item costs are absorbed into it.
      </p>
      <SubmitButton
        pendingLabel="Saving..."
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Save Fee
      </SubmitButton>
    </form>
  );
}

export function PaymentForm({ treatments }: { treatments: LedgerTreatment[] }) {
  const [state, action] = useActionState(recordPayment, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select treatment...
          </option>
          {treatments.map((r) => (
            <option key={r.treatment_id} value={r.treatment_id}>
              {r.patient_code} - {r.patient_name} (balance {formatNaira(r.balance_remaining)})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₦)">
          <input
            name="amount_paid"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClass}
            placeholder="0.00"
          />
        </Field>
        <Field label="Method">
          <select name="payment_method" className={selectClass} defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
            <option value="insurance">Insurance</option>
          </select>
        </Field>
      </div>
      <SubmitButton
        pendingLabel="Processing..."
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Collect &amp; Print Receipt
      </SubmitButton>
    </form>
  );
}