import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { formatNaira, formatDateTime, treatmentStatusBadge } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Detail = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  phone: string | null;
  gender: string | null;
  encounter_type: string;
  category: string | null;
  status: string;
  total_treatment_fee: number;
  total_paid: number;
  balance_remaining: number;
  payment_status: string;
  created_at: string;
  opened_by_name: string | null;
  items: {
    item_id: string;
    item_name: string;
    item_type: string;
    quantity: number;
    unit_cost_snapshot: number;
    handoff_type: string;
    dispensed_by_name: string | null;
    dispensed_at: string;
    dispensed_to_name: string | null;
    administered_by_name: string | null;
    administered_at: string | null;
  }[];
  payments: {
    payment_id: string;
    receipt_number: string;
    amount_paid: number;
    payment_method: string;
    cashier_name: string | null;
    created_at: string;
  }[];
  staff: { role: string; action: string; full_name: string }[];
};

export default async function TreatmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_treatment_detail", { t: id });

  if (error || !data) {
    notFound();
  }

  const d = data as Detail;

  const methodLabel: Record<string, string> = {
    cash: "Cash",
    pos_terminal: "POS",
    bank_transfer: "Bank transfer",
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Treatment Detail" subtitle={`${d.patient_code} · ${d.patient_name}`}>
        <Link
          href="/admin?tab=treatments"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          ← Back to Treatments
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Patient" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Name</div>
              <div className="mt-1 font-medium text-slate-900">{d.patient_name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Code</div>
              <div className="mt-1 font-mono text-brand-600">{d.patient_code}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Phone</div>
              <div className="mt-1 text-slate-700">{d.phone || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Gender</div>
              <div className="mt-1 capitalize text-slate-700">{d.gender || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Encounter</div>
              <div className="mt-1 capitalize text-slate-700">{d.encounter_type.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Category</div>
              <div className="mt-1 text-slate-700">{d.category || "—"}</div>
            </div>
          </div>
        </Card>

        <Card title="Treatment Status">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Status</div>
              <div className="mt-1"><Badge className={treatmentStatusBadge(d.status)}>{d.status}</Badge></div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Payment</div>
              <div className="mt-1 font-semibold text-slate-900">{d.payment_status}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Fee</div>
              <div className="mt-1 font-semibold text-slate-900">{formatNaira(d.total_treatment_fee)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Paid</div>
              <div className="mt-1 text-slate-700">{formatNaira(d.total_paid)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Balance</div>
              <div className={`mt-1 font-semibold ${d.balance_remaining > 0 ? "text-red-600" : "text-emerald-700"}`}>
                {formatNaira(d.balance_remaining)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Opened</div>
              <div className="mt-1 text-slate-600">{formatDateTime(d.created_at)}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Items Dispensed">
        {d.items.length === 0 ? (
          <EmptyState message="No items dispensed yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Handoff</th>
                  <th className="py-2 pr-3 font-medium">Dispensed by</th>
                  <th className="py-2 pr-3 font-medium">Given to</th>
                  <th className="py-2 pr-3 font-medium">Administered by</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">{it.item_name}</td>
                    <td className="py-2 pr-3 capitalize text-slate-600">{it.item_type}</td>
                    <td className="py-2 pr-3 text-slate-700">{it.quantity}</td>
                    <td className="py-2 pr-3 capitalize text-slate-600">{it.handoff_type}</td>
                    <td className="py-2 pr-3 text-slate-600">{it.dispensed_by_name || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {it.handoff_type === "nurse" ? it.dispensed_to_name || "—" : <span className="italic text-slate-400">patient</span>}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{it.administered_by_name || <span className="italic text-slate-400">pending</span>}</td>
                    <td className="whitespace-nowrap py-2 text-slate-500">{formatDateTime(it.dispensed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Payments">
        {d.payments.length === 0 ? (
          <EmptyState message="No payments recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Cashier</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {d.payments.map((pm, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs text-slate-700">{pm.receipt_number || "—"}</td>
                    <td className="py-2 pr-3 font-semibold text-slate-900">{formatNaira(pm.amount_paid)}</td>
                    <td className="py-2 pr-3 capitalize text-slate-600">{methodLabel[pm.payment_method] || pm.payment_method}</td>
                    <td className="py-2 pr-3 text-slate-600">{pm.cashier_name || "—"}</td>
                    <td className="whitespace-nowrap py-2 text-slate-500">{formatDateTime(pm.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.staff.length > 0 && (
        <Card title="Staff Involved">
          <div className="flex flex-wrap gap-3">
            {d.staff.map((s, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">{s.full_name}</div>
                <div className="text-xs capitalize text-slate-500">{s.role} · {s.action}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
