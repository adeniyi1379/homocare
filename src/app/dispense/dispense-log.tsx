"use client";

import { useMemo, useState } from "react";
import { Badge, EmptyState, inputClass } from "@/components/ui";
import { formatDateTime, formatNaira } from "@/lib/utils";

export type DispenseLogRow = {
  patient_code: string;
  patient_name: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_cost_snapshot: number | null;
  handoff_type: string | null;
  dispensed_by_name: string | null;
  dispensed_at: string;
  dispensed_to_name: string | null;
  administered_by_name: string | null;
  administered_at: string | null;
};

export function DispenseLog({
  rows,
  showCosts,
}: {
  rows: DispenseLogRow[];
  showCosts: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (d) =>
        d.item_name.toLowerCase().includes(q) ||
        d.patient_name.toLowerCase().includes(q) ||
        d.patient_code.toLowerCase().includes(q) ||
        (d.dispensed_by_name ?? "").toLowerCase().includes(q) ||
        (d.dispensed_to_name ?? "").toLowerCase().includes(q) ||
        (d.administered_by_name ?? "").toLowerCase().includes(q) ||
        (d.handoff_type === "patient" && "take-home patient".includes(q)) ||
        (d.handoff_type === "patient" && "with patient".includes(q))
    );
  }, [query, rows]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
          placeholder="Search by item, patient or the person it was handed to..."
          aria-label="Search dispensing log"
        />
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {rows.length} dispenses
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            query ? `No dispenses match "${query}".` : "No dispensations recorded yet."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Patient</th>
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                {showCosts && <th className="py-2 pr-3 font-medium">Unit cost</th>}
                <th className="py-2 pr-3 font-medium">Dispensed by</th>
                <th className="py-2 pr-3 font-medium">Handed to</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <span className="font-mono text-xs text-brand-600">{d.patient_code}</span>{" "}
                    {d.patient_name}
                  </td>
                  <td className="py-2 pr-3 font-medium text-slate-900">{d.item_name}</td>
                  <td className="py-2 pr-3">{d.quantity}</td>
                  {showCosts && (
                    <td className="py-2 pr-3 text-slate-600">
                      {formatNaira(d.unit_cost_snapshot)}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-slate-600">{d.dispensed_by_name ?? "-"}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {d.handoff_type === "patient" ? (
                      <Badge className="bg-violet-100 text-violet-700">Take-home (patient)</Badge>
                    ) : (
                      d.dispensed_to_name ?? "-"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {d.handoff_type === "patient" ? (
                      <Badge className="bg-violet-100 text-violet-700">With patient</Badge>
                    ) : d.administered_by_name ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        Given ({d.administered_by_name})
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                    )}
                  </td>
                  <td className="py-2 text-slate-500">{formatDateTime(d.dispensed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}