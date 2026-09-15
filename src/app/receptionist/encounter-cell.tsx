"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/ui";
import { UpdateEncounterForm } from "./forms";
import { treatmentStatusBadge, encounterLabel } from "@/lib/utils";
import { LifecycleActions, type LifecycleTreatment } from "@/components/lifecycle-actions";

export type EncounterSummary = LifecycleTreatment & {
  encounter_type: string;
};

export function EncounterCell({ encounters }: { encounters: EncounterSummary[] }) {
  const [editing, setEditing] = useState<EncounterSummary | null>(null);

  if (encounters.length === 0) {
    return <span className="text-xs text-slate-400">No encounters</span>;
  }

  return (
    <>
      <div className="space-y-1">
        {encounters.slice(0, 4).map((t) => {
          const badgeClass = treatmentStatusBadge(t.status);
          const label = (
            <>
              {encounterLabel(t.encounter_type)}
              <span className="lowercase"> - {t.status}</span>
            </>
          );

          return (
            <div key={t.id} className="flex flex-wrap items-center gap-1">
              {t.status !== "active" ? (
                <Badge className={badgeClass}>{label}</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  title="Change encounter type"
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-all hover:-translate-y-px hover:shadow hover:ring-2 hover:ring-brand-300 ${badgeClass}`}
                >
                  {label}
                </button>
              )}
              <LifecycleActions treatment={t} />
            </div>
          );
        })}
      </div>

      <Modal
        open={editing !== null}
        title="Change Encounter Type"
        onClose={() => setEditing(null)}
      >
        {editing && <UpdateEncounterForm treatment={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
