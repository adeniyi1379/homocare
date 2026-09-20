"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { RegisterPatientForm, OpenEncounterForm, type CategoryOption, type BranchOption } from "./forms";
import type { PatientOption } from "@/components/patient-picker";

export function ReceptionistActions({
  patients,
  categories,
  branches,
  isAdmin,
}: {
  patients: PatientOption[];
  categories: CategoryOption[];
  branches: BranchOption[];
  isAdmin: boolean;
}) {
  const [active, setActive] = useState<"register" | "open" | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActive("register")}
          className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.26)]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-700 via-brand-400 to-teal-400"
          />
          <span
            aria-hidden="true"
            className="absolute right-4 top-4 text-xl text-brand-400 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100"
          >
            &rarr;
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-display text-xl font-bold leading-none text-white shadow-md shadow-brand-900/20 transition-transform group-hover:scale-105">
            +
          </span>
          <span className="mt-3 font-display text-lg font-bold text-slate-900">
            Register Patient
          </span>
          <span className="mt-1 text-sm text-slate-500">
            Capture a new patient&rsquo;s details and assign their ID / file number.
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActive("open")}
          className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.26)]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-brand-600"
          />
          <span
            aria-hidden="true"
            className="absolute right-4 top-4 text-xl text-brand-400 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100"
          >
            &rarr;
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 font-display text-xl font-bold leading-none text-white shadow-md shadow-cyan-900/30 transition-transform group-hover:scale-105">
            +
          </span>
          <span className="mt-3 font-display text-lg font-bold text-slate-900">
            Open Encounter
          </span>
          <span className="mt-1 text-sm text-slate-500">
            Search for an existing patient and start a one-time, admission or recurring care visit.
          </span>
        </button>
      </div>

      <Modal open={active === "register"} title="Register Patient" onClose={() => setActive(null)}>
        <RegisterPatientForm branches={branches} isAdmin={isAdmin} onDone={() => setActive(null)} />
      </Modal>

      <Modal open={active === "open"} title="Open Treatment Encounter" onClose={() => setActive(null)}>
        {patients.length > 0 ? (
          <OpenEncounterForm
            patients={patients}
            categories={categories}
            branches={branches}
            isAdmin={isAdmin}
            onDone={() => setActive(null)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            No patients yet. Register a patient first via the Register Patient action.
          </p>
        )}
      </Modal>
    </>
  );
}