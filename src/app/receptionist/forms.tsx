"use client";

import { useActionState } from "react";
import { registerPatient, openEncounter } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";

export function RegisterPatientForm() {
  const [state, action] = useActionState(registerPatient, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Full name">
        <input name="full_name" required className={inputClass} placeholder="Patient full name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input name="phone" className={inputClass} placeholder="080x xxx xxxx" />
        </Field>
        <Field label="Gender">
          <select name="gender" className={selectClass} defaultValue="">
            <option value="">--</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-slate-400">
        Patient code (HC-YYYY-XXXX) is generated automatically and printed on the receipt as the
        patient ID.
      </p>
      <SubmitButton pendingLabel="Registering...">Register Patient</SubmitButton>
    </form>
  );
}

export function OpenEncounterForm({
  patients,
}: {
  patients: { id: string; patient_code: string; full_name: string }[];
}) {
  const [state, action] = useActionState(openEncounter, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Patient">
        <select name="patient_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select patient...
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.patient_code} - {p.full_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Encounter type">
        <select name="encounter_type" required className={selectClass} defaultValue="one_time">
          <option value="one_time">One-Time Treatment (outpatient / emergency)</option>
          <option value="admission">Admission (inpatient ward stay)</option>
          <option value="recurring">Recurring Care (antenatal, wound care, chronic)</option>
        </select>
      </Field>
      <Field label="Category">
        <input
          name="category"
          className={inputClass}
          placeholder="e.g. General Outpatient, Antenatal, Wound Care, Minor Surgery"
        />
      </Field>
      <SubmitButton pendingLabel="Opening...">Open Encounter</SubmitButton>
    </form>
  );
}