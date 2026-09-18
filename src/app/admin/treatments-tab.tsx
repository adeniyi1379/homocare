"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatNaira, formatDateTime, treatmentStatusBadge } from "@/lib/utils";

type TreatmentRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number;
  total_paid: number;
  balance_remaining: number;
  payment_status: string;
  created_at: string;
};

export function TreatmentsTab({ treatments }: { treatments: TreatmentRow[] }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const fromDate = from ? new Date(from + "T00:00:00") : null;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : null;

    return treatments.filter((t) => {
      if (query && !t.patient_name.toLowerCase().includes(query) && !t.patient_code.toLowerCase().includes(query)) {
        return false;
      }
      if (fromDate || toDate) {
        const d = new Date(t.created_at);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      return true;
    });
  }, [treatments, q, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search patient name or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:w-64"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No treatments match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Patient</th>
                <th className="py-2 pr-3 font-medium">Encounter</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Fee</th>
                <th className="py-2 pr-3 font-medium">Paid</th>
                <th className="py-2 pr-3 font-medium">Balance</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.treatment_id}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium text-slate-900">{t.patient_name}</div>
                    <div className="font-mono text-xs text-brand-600">{t.patient_code}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="capitalize text-slate-700">{t.encounter_type.replace(/_/g, " ")}</div>
                    {t.category && <div className="mt-0.5 text-xs text-slate-400">{t.category}</div>}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={treatmentStatusBadge(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="py-2 pr-3">{formatNaira(t.total_treatment_fee)}</td>
                  <td className="py-2 pr-3">{formatNaira(t.total_paid)}</td>
                  <td className="py-2 pr-3">{formatNaira(t.balance_remaining)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{formatDateTime(t.created_at)}</td>
                  <td className="py-2">
                    <Link
                      href={`/admin/treatments/${t.treatment_id}`}
                      className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                    >
                      View detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
