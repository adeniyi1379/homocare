import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import {
  formatDateTime,
  formatNaira,
  itemCategoryLabel,
  isStockedCategory,
  stockBadge,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  item_name: string;
  category: string;
  stock_quantity: number;
  reorder_level: number;
  unit_cost_price: number | null;
  sell_price: number;
  stock_status: "LOW" | "OK" | "OUT OF STOCK";
  branch_id: string | null;
};

type UsageRow = {
  treatment_id: string;
  patient_code: string;
  patient_name: string;
  encounter_label: string;
  quantity: number;
  unit_cost_snapshot: number | null;
  handoff_type: string;
  dispensed_by_name: string | null;
  dispensed_at: string;
  dispensed_to_name: string | null;
  administered_by_name: string | null;
};

function encounterLabel(type: string): string {
  switch (type) {
    case "one_time":
      return "One-Time Treatment";
    case "admission":
      return "Admission";
    case "recurring":
      return "Recurring Care";
    default:
      return type;
  }
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await requireRole(["dispenser", "nurse", "admin"]);
  const showCosts = current.profile.role === "dispenser" || current.profile.role === "admin";
  const isAdmin = current.profile.role === "admin";

  const supabase = await createClient();
  const { data: itemRes } = await supabase
    .from("v_stock_status")
    .select(
      "id, item_name, category, stock_quantity, reorder_level, unit_cost_price, sell_price, stock_status, branch_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!itemRes) notFound();
  const item = itemRes as ItemRow;

  if (!isAdmin && item.branch_id && item.branch_id !== current.profile.branch_id) {
    notFound();
  }

  const admin = createAdminClient();
  const extra = showCosts ? ", unit_cost_snapshot" : "";
  const { data: raw } = await admin
    .from("treatment_dispensations")
    .select(
      "treatment_id, quantity, handoff_type, dispensed_by, dispensed_at, dispensed_to, administered_by, administered_at" +
        extra
    )
    .eq("item_id", id)
    .order("dispensed_at", { ascending: false });

  const rows = ((raw ?? []) as unknown as {
    treatment_id: string;
    quantity: number;
    unit_cost_snapshot: number | null;
    handoff_type: string | null;
    dispensed_by: string | null;
    dispensed_at: string;
    dispensed_to: string | null;
    administered_by: string | null;
  }[]);

  const treatmentIds = Array.from(new Set(rows.map((r) => r.treatment_id)));
  const personIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.dispensed_by, r.dispensed_to, r.administered_by].filter(Boolean))
    )
  );

  const { data: treatments } = treatmentIds.length > 0
    ? await admin.from("treatments").select("id, encounter_type, patient_id").in("id", treatmentIds)
    : { data: [] };

  const patientIds = Array.from(new Set((treatments ?? []).map((t) => t.patient_id)));

  const [{ data: patients }, { data: profiles }] = await Promise.all([
    patientIds.length > 0
      ? admin.from("patients").select("id, patient_code, full_name").in("id", patientIds)
      : Promise.resolve({ data: [] }),
    personIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", personIds)
      : Promise.resolve({ data: [] }),
  ]);

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const treatmentById = new Map((treatments ?? []).map((t) => [t.id, t]));

  const usage: UsageRow[] = rows.map((r) => {
    const tr = treatmentById.get(r.treatment_id);
    const pt = patientById.get(tr?.patient_id ?? "");
    return {
      treatment_id: r.treatment_id,
      patient_code: pt?.patient_code ?? "",
      patient_name: pt?.full_name ?? "Unknown patient",
      encounter_label: tr ? encounterLabel(tr.encounter_type) : "-",
      quantity: r.quantity,
      unit_cost_snapshot: showCosts ? r.unit_cost_snapshot ?? null : null,
      handoff_type: r.handoff_type ?? "nurse",
      dispensed_by_name: r.dispensed_by ? profileById.get(r.dispensed_by) ?? null : null,
      dispensed_at: r.dispensed_at,
      dispensed_to_name: r.dispensed_to ? profileById.get(r.dispensed_to) ?? null : null,
      administered_by_name: r.administered_by
        ? profileById.get(r.administered_by) ?? null
        : null,
    };
  });

  const totalDispensed = usage.reduce((sum, u) => sum + u.quantity, 0);
  const totalCost = usage.reduce((sum, u) => sum + u.quantity * (u.unit_cost_snapshot ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title={item.item_name} subtitle="Dispensing history and stock breakdown">
        <Link
          href="/dispense"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          ← Back to Dispense
        </Link>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge className={stockBadge(item.stock_status)}>
          {item.stock_status === "OK" ? "OK" : item.stock_status}
        </Badge>
        <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700">
          {itemCategoryLabel(item.category)}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
          {isStockedCategory(item.category)
            ? `${item.stock_quantity} in stock · reorder at ${item.reorder_level}`
            : "Charge-only service line"}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
          Sells at {formatNaira(item.sell_price)}
        </span>
        {showCosts && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
            Unit cost {formatNaira(item.unit_cost_price)}
          </span>
        )}
      </div>

      <Card title="Dispensing History">
        {usage.length === 0 ? (
          <EmptyState message="No dispensations recorded for this item yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Encounter</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  {showCosts && (
                    <>
                      <th className="py-2 pr-3 font-medium">Unit cost</th>
                      <th className="py-2 pr-3 font-medium">Line total</th>
                    </>
                  )}
                  <th className="py-2 pr-3 font-medium">Dispensed by</th>
                  <th className="py-2 pr-3 font-medium">Handed to</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">At</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-brand-600">{u.patient_code}</span>{" "}
                      {u.patient_name}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{u.encounter_label}</td>
                    <td className="py-2 pr-3 font-semibold">{u.quantity}</td>
                    {showCosts && (
                      <>
                        <td className="py-2 pr-3 text-slate-600">
                          {formatNaira(u.unit_cost_snapshot)}
                        </td>
                        <td className="py-2 pr-3 font-semibold">
                          {formatNaira(u.quantity * (u.unit_cost_snapshot ?? 0))}
                        </td>
                      </>
                    )}
                    <td className="py-2 pr-3 text-slate-600">{u.dispensed_by_name ?? "-"}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {u.handoff_type === "patient" ? (
                        <Badge className="bg-violet-100 text-violet-700">
                          Take-home (patient)
                        </Badge>
                      ) : (
                        u.dispensed_to_name ?? "-"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {u.handoff_type === "patient" ? (
                        <Badge className="bg-violet-100 text-violet-700">With patient</Badge>
                      ) : u.administered_by_name ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          Given ({u.administered_by_name})
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 text-slate-500">
                      {formatDateTime(u.dispensed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {showCosts && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="py-2 pr-3" colSpan={2}>
                      Totals
                    </td>
                    <td className="py-2 pr-3">{totalDispensed}</td>
                    <td className="py-2 pr-3" colSpan={2}>
                      {formatNaira(totalCost)}
                    </td>
                    <td className="py-2 pr-3" colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {showCosts && (
          <p className="mt-3 text-xs text-slate-400">
            Costs shown are internal purchase costs - never exposed on receipts or cashier views.
          </p>
        )}
      </Card>
    </div>
  );
}