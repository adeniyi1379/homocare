"use client";

import { useState, useTransition } from "react";
import { endTreatment, cancelTreatment } from "@/lib/lifecycle-actions";
import { FormError } from "./form-ui";

export type LifecycleTreatment = { id: string; status: string };

function ConfirmButtons({
  label,
  onConfirm,
  onCancel,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="btn btn-sm bg-brand-600 text-white hover:bg-brand-700"
      >
        {label}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCancel}
        className="btn btn-ghost btn-sm text-slate-500"
      >
        Back
      </button>
    </span>
  );
}

export function LifecycleActions({ treatment }: { treatment: LifecycleTreatment }) {
  const [confirm, setConfirm] = useState<"end" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (treatment.status !== "active" && treatment.status !== "discharged") return null;

  const run = (kind: "end" | "cancel") => {
    setError(null);
    startTransition(async () => {
      const err = await (kind === "end" ? endTreatment : cancelTreatment)(treatment.id);
      if (err) setError(err);
      else {
        setConfirm(null);
        setError(null);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      {confirm === null && (
        <>
          <button
            type="button"
            onClick={() => setConfirm("end")}
            className="btn btn-ghost btn-sm text-xs text-emerald-700 hover:bg-emerald-50"
          >
            End
          </button>
          {treatment.status === "active" && (
            <button
              type="button"
              onClick={() => setConfirm("cancel")}
              className="btn btn-ghost btn-sm text-xs text-red-600 hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </>
      )}

      {confirm === "end" && (
        <ConfirmButtons
          label="End?"
          onConfirm={() => run("end")}
          onCancel={() => { setConfirm(null); setError(null); }}
          disabled={pending}
        />
      )}

      {confirm === "cancel" && (
        <ConfirmButtons
          label="Cancel?"
          onConfirm={() => run("cancel")}
          onCancel={() => { setConfirm(null); setError(null); }}
          disabled={pending}
        />
      )}

      {error && (
        <span className="ml-1 max-w-[200px] text-xs leading-tight text-red-600">
          <FormError message={error} />
        </span>
      )}
    </span>
  );
}