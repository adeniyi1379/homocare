"use client";

import { SearchPicker } from "@/components/search-picker";

export type PatientOption = {
  id: string;
  patient_code: string;
  full_name: string;
  phone: string | null;
  branch_id?: string | null;
};

export function PatientPicker({ patients }: { patients: PatientOption[] }) {
  const options = patients.map((p) => ({
    id: p.id,
    primary: p.patient_code,
    secondary: p.full_name,
    detail: p.phone,
  }));

  return (
    <SearchPicker
      options={options}
      name="patient_id"
      placeholder="Type patient name, ID or phone, then select..."
      emptyText="No matching patients. Register them via the Register Patient action."
    />
  );
}