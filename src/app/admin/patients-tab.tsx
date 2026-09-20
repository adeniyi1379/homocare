"use client";

import { useMemo, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { formatNaira, formatDateTime, treatmentStatusBadge } from "@/lib/utils";

export type PatientRow = {
  id: string;
  patient_code: string;
  full_name: string;
  phone: string | null;
  gender: string | null;
  branch_id: string | null;
  created_at: string;
};

export type TreatmentBalanceRow = {
  treatment_id: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  encounter_type: string;
  category: string | null;
  status: string;
  created_at: string;
  branch_id: string | null;
  total_treatment_fee: number;
  total_paid: number;
  balance_remaining: number;
};

export type PaymentRow = {
  treatment_id: string;
  patient_id: string;
  amount_paid: number;
  payment_method: string;
  created_at: string;
  receipt_number: string | null;
};

export type DispenseRow = {
  treatment_id: string;
  patient_id: string;
  item_name: string;
  quantity: number;
  handoff_type: string | null;
  dispensed_at: string;
};

export type BranchOption = {
  id: string;
  name: string;
  code: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  pos_terminal: "POS",
  bank_transfer: "Bank transfer",
};

export function PatientsTab({
  patients,
  treatments,
  payments,
  dispensations,
  branches,
}: {
  patients: PatientRow[];
  treatments: TreatmentBalanceRow[];
  payments: PaymentRow[];
  dispensations: DispenseRow[];
  branches: BranchOption[];
}) {
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (branch && p.branch_id !== branch) return false;
      if (!query) return true;
      return (
        p.full_name.toLowerCase().includes(query) ||
        p.patient_code.toLowerCase().includes(query) ||
        (p.phone ?? "").includes(query)
      );
    });
  }, [patients, q, branch]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name;

  const selected = selectedId ? patients.find((p) => p.id === selectedId) : null;

  const detail = useMemo(() => {
    if (!selected) return null;

    const patientTreatments = treatments.filter((t) => t.patient_id === selected.id);
    const patientPayments = payments.filter((p) => p.patient_id === selected.id);
    const patientDispenses = dispensations.filter((d) => d.patient_id === selected.id);

    const fromDate = from ? new Date(from + "T00:00:00") : null;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : null;
    const inRange = (d: string) => {
      const dt = new Date(d);
      if (fromDate && dt < fromDate) return false;
      if (toDate && dt > toDate) return false;
      return true;
    };

    const rangePayments = patientPayments.filter((p) => inRange(p.created_at));
    const revenue = rangePayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);

    return {
      patientTreatments,
      patientPayments,
      patientDispenses: patientDispenses.filter((d) => inRange(d.dispensed_at)),
      revenue,
      totalBilled: patientTreatments.reduce((s, t) => s + Number(t.total_treatment_fee || 0), 0),
      totalPaid: patientPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0),
    };
  }, [selected, treatments, payments, dispensations, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, code or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:w-72"
        />
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="self-center text-sm text-slate-500">{filtered.length} patients</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No patients match your filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">File no.</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Gender</th>
                <th className="py-2 pr-3 font-medium">Phone</th>
                <th className="py-2 pr-3 font-medium">Branch</th>
                <th className="py-2 pr-3 font-medium">Registered</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const rowTreatments = treatments.filter((t) => t.patient_id === p.id);
                const totalBilled = rowTreatments.reduce(
                  (s, t) => s + Number(t.total_treatment_fee || 0),
                  0,
                );
                const totalPaid = rowTreatments.reduce((s, t) => s + Number(t.total_paid || 0), 0);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-brand-600">
                      {p.patient_code}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{p.full_name}</td>
                    <td className="py-2 pr-3 capitalize text-slate-600">{p.gender ?? "-"}</td>
                    <td className="py-2 pr-3 text-slate-600">{p.phone ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {p.branch_id ? (
                        <Badge tone="neutral">{branchName(p.branch_id)}</Badge>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">
                      {formatDateTime(p.created_at)}
                      <div className="text-xs text-slate-400">
                        {formatNaira(totalBilled)} billed · {formatNaira(totalPaid)} paid
                      </div>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                        className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        {selectedId === p.id ? "Hide detail" : "View detail"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && detail && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-brand-600">{selected.patient_code}</div>
              <h3 className="text-lg font-semibold text-slate-900">{selected.full_name}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded bg-slate-100 px-2 py-0.5 capitalize">{selected.gender ?? "Gender n/a"}</span>
                {selected.phone && (
                  <span className="rounded bg-slate-100 px-2 py-0.5">{selected.phone}</span>
                )}
                <span className="rounded bg-slate-100 px-2 py-0.5">
                  {selected.branch_id ? branchName(selected.branch_id) : "No branch"}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5">
                  Registered {formatDateTime(selected.created_at)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Total billed</div>
                <div className="font-semibold text-slate-900">{formatNaira(detail.totalBilled)}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2">
                <div className="text-xs text-slate-500">Total paid</div>
                <div className="font-semibold text-emerald-700">{formatNaira(detail.totalPaid)}</div>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2">
                <div className="text-xs text-slate-500">Balance</div>
                <div className="font-semibold text-amber-700">
                  {formatNaira(detail.totalBilled - detail.totalPaid)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <span className="text-sm font-semibold text-slate-700">Revenue in range:</span>
            <span className="font-semibold text-brand-700">{formatNaira(detail.revenue)}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Treatments</h4>
            {detail.patientTreatments.length === 0 ? (
              <p className="text-sm text-slate-400">No treatments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Encounter</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Fee</th>
                      <th className="py-2 pr-3 font-medium">Paid</th>
                      <th className="py-2 pr-3 font-medium">Balance</th>
                      <th className="py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.patientTreatments.map((t) => (
                      <tr key={t.treatment_id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          <div className="capitalize text-slate-700">
                            {t.encounter_type.replace(/_/g, " ")}
                          </div>
                          {t.category && (
                            <div className="mt-0.5 text-xs text-slate-400">{t.category}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge className={treatmentStatusBadge(t.status)}>{t.status}</Badge>
                        </td>
                        <td className="py-2 pr-3">{formatNaira(t.total_treatment_fee)}</td>
                        <td className="py-2 pr-3">{formatNaira(t.total_paid)}</td>
                        <td className="py-2 pr-3">{formatNaira(t.balance_remaining)}</td>
                        <td className="whitespace-nowrap py-2 text-slate-500">
                          {formatDateTime(t.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Medication history</h4>
            {detail.patientDispenses.length === 0 ? (
              <p className="text-sm text-slate-400">No medications dispensed in this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 font-medium">Qty</th>
                      <th className="py-2 pr-3 font-medium">Handoff</th>
                      <th className="py-2 font-medium">Dispensed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.patientDispenses.map((d, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-900">{d.item_name}</td>
                        <td className="py-2 pr-3">{d.quantity}</td>
                        <td className="py-2 pr-3 capitalize text-slate-600">
                          {d.handoff_type === "patient" ? "Take-home" : (d.handoff_type ?? "nurse")}
                        </td>
                        <td className="whitespace-nowrap py-2 text-slate-500">
                          {formatDateTime(d.dispensed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Payments</h4>
            {detail.patientPayments.length === 0 ? (
              <p className="text-sm text-slate-400">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Receipt</th>
                      <th className="py-2 pr-3 font-medium">Method</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 font-medium">At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.patientPayments.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-xs text-brand-600">
                          {p.receipt_number ?? "-"}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {PAYMENT_LABELS[p.payment_method] ?? p.payment_method}
                        </td>
                        <td className="py-2 pr-3 font-semibold">{formatNaira(p.amount_paid)}</td>
                        <td className="whitespace-nowrap py-2 text-slate-500">
                          {formatDateTime(p.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}