"use client";

import { useEffect, useRef, useActionState } from "react";
import {
  registerPatient,
  openEncounter,
  updateEncounter,
} from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { PatientPicker, type PatientOption } from "@/components/patient-picker";

export type CategoryOption = { id: string; name: string };

export function RegisterPatientForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(registerPatient, undefined);
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
        <input name="full_name" required className={inputClass} placeholder="Patient full name" />
      </Field>
      <Field label="Patient ID / File number">
        <input
          name="patient_code"
          required
          className={inputClass}
          placeholder="e.g. HGC-0001"
        />
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
        Enter the hospital&rsquo;s existing patient ID / file number. Each one must be unique.
      </p>
      <SubmitButton pendingLabel="Registering...">Register Patient</SubmitButton>
    </form>
  );
}

export function OpenEncounterForm({
  patients,
  categories,
  onDone,
}: {
  patients: PatientOption[];
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(openEncounter, undefined);
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
      <Field label="Patient">
        <PatientPicker patients={patients} />
      </Field>
      <Field label="Encounter type">
        <select name="encounter_type" required className={selectClass} defaultValue="one_time">
          <option value="one_time">One-Time Treatment (outpatient / emergency)</option>
          <option value="admission">Admission (inpatient ward stay)</option>
          <option value="recurring">Recurring Care (antenatal, wound care, chronic)</option>
        </select>
      </Field>
      <Field label="Category">
        <select name="category" className={selectClass} defaultValue="">
          <option value="" disabled>
            Select intake category...
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pendingLabel="Opening...">Open Encounter</SubmitButton>
    </form>
  );
}

export function UpdateEncounterForm({
  treatment,
  onDone,
}: {
  treatment: { id: string; encounter_type: string };
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateEncounter, undefined);
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
      <input type="hidden" name="treatment_id" value={treatment.id} />
      <Field label="Encounter type">
        <select
          name="encounter_type"
          required
          className={selectClass}
          defaultValue={treatment.encounter_type}
        >
          <option value="one_time">One-Time Treatment (outpatient / emergency)</option>
          <option value="admission">Admission (inpatient ward stay)</option>
          <option value="recurring">Recurring Care (antenatal, wound care, chronic)</option>
        </select>
      </Field>
      <SubmitButton pendingLabel="Saving...">Save Changes</SubmitButton>
    </form>
  );
}