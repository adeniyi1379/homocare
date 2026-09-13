import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SetFeeForm, PaymentForm, type LedgerTreatment } from "./forms";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatNaira, encounterLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LedgerRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  phone: string | null;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number | null;
  total_paid: number;
  balance_remaining: number;
  payment_status: "UNPAID" | "PARTIAL" | "PAID IN FULL";
};

export default async function CashierPage() {
  await requireRole(["cashier", "admin"]);

  const supabase = await createClient();

  const [{ data: ledger }] = await Promise.all([
    supabase.from("v_treatment_balance").select("*").order("total_paid", { ascending: false }),
  ]);

  const rows = (ledger ?? []) as LedgerRow[];
  const unpaid = rows.filter((r) => r.payment_status !== "PAID IN FULL" && r.status !== "cancelled");
  const collectible = unpaid.filter((r) => Number(r.total_treatment_fee ?? 0) > 0);
  const totalCollectible = collectible.reduce(
    (sum, r) => sum + Number(r.balance_remaining ?? 0),
    0
  );

  const dueLabel = (r: LedgerRow) => {
    if (r.status === "cancelled") return { text: "CANCELLED", cls: "bg-slate-100 text-slate-500" };
    switch (r.payment_status) {
      case "UNPAID":
        return { text: "UNPAID", cls: "bg-red-100 text-red-700" };
      case "PARTIAL":
        return { text: "PARTIAL", cls: "bg-amber-100 text-amber-700" };
      default:
        return { text: "PAID IN FULL", cls: "bg-emerald-100 text-emerald-700" };
    }
  };

  const binding = (r: LedgerRow): LedgerTreatment => ({
    treatment_id: r.treatment_id,
    patient_code: r.patient_code,
    patient_name: r.patient_name,
    encounter_type: r.encounter_type,
    category: r.category,
    status: r.status,
    total_treatment_fee: r.total_treatment_fee,
    total_paid: r.total_paid,
    balance_remaining: r.balance_remaining,
    payment_status: r.payment_status,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing &amp; Payments</h1>
          <p className="text-sm text-slate-500">
            Set the treatment fee manually and collect payments. Receipts NEVER show medication or
            internal costs.
          </p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700">
          Collecting {formatNaira(totalCollectible)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Set Treatment Fee">
          {rows.length > 0 ? (
            <SetFeeForm treatments={rows.map(binding)} />
          ) : (
            <EmptyState message="No treatments to bill." />
          )}
        </Card>

        <Card title="Record Payment">
          {collectible.length > 0 ? (
            <PaymentForm treatments={collectible.map(binding)} />
          ) : (
            <EmptyState message="No outstanding balances to collect." />
          )}
        </Card>
      </div>

      <Card title="Treatment Ledger">
        {rows.length === 0 ? (
          <EmptyState message="No treatments yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Fee</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Balance</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const due = dueLabel(r);
                  return (
                    <tr key={r.treatment_id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{r.patient_name}</div>
                        <div className="font-mono text-xs text-teal-700">{r.patient_code}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {encounterLabel(r.encounter_type)}
                        {r.category && <div className="text-xs text-slate-400">{r.category}</div>}
                      </td>
                      <td className="py-2 pr-3 text-slate-900">
                        {r.total_treatment_fee === null || r.total_treatment_fee === undefined
                          ? "—"
                          : formatNaira(r.total_treatment_fee)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {formatNaira(r.total_paid)}
                      </td>
                      <td
                        className={`py-2 pr-3 font-semibold ${
                          Number(r.balance_remaining) > 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {formatNaira(r.balance_remaining)}
                      </td>
                      <td className="py-2">
                        <Badge className={due.cls}>{due.text}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}