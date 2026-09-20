"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAdministration } from "./actions";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export type PendingDispenseRow = {
  id: string;
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  item_name: string;
  quantity: number;
  dispensed_by_name: string | null;
  dispensed_at: string;
};

export type DispenseHistoryRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  item_name: string;
  quantity: number;
  dispensed_by_name: string | null;
  dispensed_at: string;
  administered_at: string;
};

export function DispenseHandoff({
  pending,
  history,
}: {
  pending: PendingDispenseRow[];
  history: DispenseHistoryRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(interval);
  }, [router]);

  async function handleAdminister(id: string) {
    setBusyId(id);
    setError(null);
    const result = await confirmAdministration(id);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Card title="Items Dispensed to You · Pending Administration">
        <p className="mb-4 text-xs text-slate-500">
          The dispense desk has handed these items to you for a specific patient treatment. When you
          have administered them, click the button to close the loop - you are then recorded as
          the administering staff.
        </p>
        {pending.length === 0 ? (
          <EmptyState message="No pending dispensed items handed to you right now." />
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="table-modern w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Patient</th>
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">Qty</th>
                    <th className="py-2 pr-3 font-medium">Dispensed by</th>
                    <th className="py-2 pr-3 font-medium">At</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-xs text-brand-600">
                          {r.patient_code}
                        </span>{" "}
                        {r.patient_name}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-900">{r.item_name}</td>
                      <td className="py-2 pr-3">{r.quantity}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {r.dispensed_by_name ?? "Pharmacy"}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {formatDateTime(r.dispensed_at)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleAdminister(r.id)}
                          disabled={busyId === r.id}
                          className="btn btn-primary btn-sm"
                        >
                          {busyId === r.id ? "Confirming…" : "Item Administered"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="My Pharmacy Administration History">
        {history.length === 0 ? (
          <EmptyState message="You have not administered any dispensed items yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Dispensed by</th>
                  <th className="py-2 pr-3 font-medium">Dispensed at</th>
                  <th className="py-2 font-medium">You gave at</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-brand-600">
                        {h.patient_code}
                      </span>{" "}
                      {h.patient_name}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{h.item_name}</td>
                    <td className="py-2 pr-3">{h.quantity}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {h.dispensed_by_name ?? "Pharmacy"}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">
                      {formatDateTime(h.dispensed_at)}
                    </td>
                    <td className="py-2">
                      <Badge className="bg-emerald-100 text-emerald-700">
                        {formatDateTime(h.administered_at)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}