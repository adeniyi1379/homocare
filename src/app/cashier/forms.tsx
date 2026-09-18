"use client";

import { useActionState, useState } from "react";
import { collectPayment } from "./actions";
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

export function CollectPaymentForm({ treatments }: { treatments: LedgerTreatment[] }) {
  const [state, action] = useActionState(collectPayment, undefined);
  const [selectedId, setSelectedId] = useState("");
  const selected = treatments.find((t) => t.treatment_id === selectedId);
  const balance = selected ? Number(selected.balance_remaining) : 0;
  const fee = selected ? Number(selected.total_treatment_fee ?? 0) : 0;

  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />

      <Field label="Treatment">
        <select
          name="treatment_id"
          required
          className={selectClass}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="" disabled>
            Select treatment...
          </option>
          {treatments.map((r) => (
            <option key={r.treatment_id} value={r.treatment_id}>
              {r.patient_code} — {r.patient_name} ({encounterLabel(r.encounter_type)})
            </option>
          ))}
        </select>
      </Field>

      {selected && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-slate-400">Fee</div>
              <div className="font-semibold text-slate-900">
                {fee > 0 ? formatNaira(fee) : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Paid</div>
              <div className="font-semibold text-emerald-700">
                {formatNaira(selected.total_paid)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Balance</div>
              <div
                className={`font-semibold ${
                  balance > 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {formatNaira(balance)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Treatment Fee (${String.fromCharCode(0x20A6)})`}>
          <input
            name="total_treatment_fee"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            placeholder={fee > 0 ? String(fee) : "0.00"}
            defaultValue={fee > 0 ? fee : ""}
          />
        </Field>
          <Field label={`Amount to Collect (${String.fromCharCode(0x20A6)})`}>
          <input
            name="amount_paid"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClass}
            placeholder={balance > 0 ? String(balance) : "0.00"}
            defaultValue={balance > 0 ? balance : ""}
          />
        </Field>
      </div>

      <Field label="Payment Method">
        <select name="payment_method" className={selectClass} defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="pos_terminal">POS Terminal</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </Field>

      <SubmitButton pendingLabel="Processing...">Collect &amp; Print Receipt</SubmitButton>
    </form>
  );
}
