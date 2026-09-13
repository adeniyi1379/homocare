"use client";

import { useActionState } from "react";
import { administerDose, recordVitals } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { encounterLabel } from "@/lib/utils";

export type TreatmentOption = {
  id: string;
  patient_code: string;
  full_name: string;
  encounter_type: string;
};

export type ItemOption = {
  id: string;
  item_name: string;
  item_type: string;
  stock_quantity: number;
};

export function AdministerDoseForm({
  treatments,
  items,
}: {
  treatments: TreatmentOption[];
  items: ItemOption[];
}) {
  const [state, action] = useActionState(administerDose, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select active care...
          </option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patient_code} - {t.full_name} ({encounterLabel(t.encounter_type)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Item (stock is reduced immediately)">
        <select name="item_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select item in stock...
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.item_name} ({i.item_type}, {i.stock_quantity} left)
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity / dose">
        <input
          name="quantity"
          type="number"
          min={1}
          required
          className={inputClass}
          defaultValue={1}
        />
      </Field>
      <SubmitButton
        pendingLabel="Saving..."
        className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
      >
        Administer Dose
      </SubmitButton>
    </form>
  );
}

export function VitalsForm({ treatments }: { treatments: TreatmentOption[] }) {
  const [state, action] = useActionState(recordVitals, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select active care...
          </option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patient_code} - {t.full_name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Temp (°C)">
          <input
            name="temperature"
            type="number"
            step="0.1"
            className={inputClass}
            placeholder="36.5"
          />
        </Field>
        <Field label="BP Sys">
          <input name="systolic" type="number" className={inputClass} placeholder="120" />
        </Field>
        <Field label="BP Dia">
          <input name="diastolic" type="number" className={inputClass} placeholder="80" />
        </Field>
      </div>
      <Field label="Pulse (bpm)">
        <input name="pulse" type="number" className={inputClass} placeholder="72" />
      </Field>
      <Field label="Remarks">
        <textarea
          name="remarks"
          rows={2}
          className={inputClass}
          placeholder="Clinical notes"
        />
      </Field>
      <SubmitButton
        pendingLabel="Saving..."
        className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
      >
        Save Vitals
      </SubmitButton>
    </form>
  );
}