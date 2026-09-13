import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AddItemForm,
  DispenseToTreatmentForm,
  AdjustStockForm,
} from "./forms";
import type { TreatmentOption } from "@/app/nurse/forms";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDateTime, formatNaira, stockBadge, oneOrNull } from "@/lib/utils";

export const dynamic = "force-dynamic";

type StockRow = {
  id: string;
  item_name: string;
  item_type: string;
  stock_quantity: number;
  reorder_level: number;
  unit_cost_price: number;
  stock_status: "LOW" | "OK" | "OUT OF STOCK";
};

type TreatmentRow = {
  id: string;
  encounter_type: string;
  category: string | null;
  status: string;
  patients:
    | { id: string; patient_code: string; full_name: string }
    | { id: string; patient_code: string; full_name: string }[];
};

export default async function PharmacyPage() {
  await requireRole(["pharmacy", "admin"]);

  const supabase = await createClient();

  const [{ data: stock }, { data: treatments }, { data: log }] = await Promise.all([
    supabase.from("v_stock_status").select("*"),
    supabase
      .from("treatments")
      .select("id, encounter_type, category, status, patients(id, patient_code, full_name)")
      .in("status", ["active", "discharged"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("get_pharmacy_log", { limit_count: 30 }),
  ]);

  const rows = (stock ?? []) as StockRow[];
  const priority = { "OUT OF STOCK": 0, LOW: 1, OK: 2 } as const;
  rows.sort(
    (a, b) =>
      (priority[a.stock_status] ?? 9) - (priority[b.stock_status] ?? 9) ||
      a.item_name.localeCompare(b.item_name)
  );

  const lowStockCount = rows.filter((r) => r.stock_status !== "OK").length;

  const treatmentsList = (treatments ?? []) as TreatmentRow[];
  const dispenseOptions: TreatmentOption[] = treatmentsList
    .filter((t) => t.status === "active")
    .map((t) => ({
      id: t.id,
      patient_code: oneOrNull(t.patients)?.patient_code ?? "",
      full_name: oneOrNull(t.patients)?.full_name ?? "Unknown patient",
      encounter_type: t.encounter_type,
    }));

  const dispenseItems = rows.map((i) => ({
    id: i.id,
    item_name: i.item_name,
    item_type: i.item_type,
    stock_quantity: i.stock_quantity,
  }));

  const logRows = (log ?? []) as unknown as {
    patient_code: string;
    patient_name: string;
    item_name: string;
    quantity: number;
    unit_cost_snapshot: number;
    dispensed_by_name: string | null;
    dispensed_at: string;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pharmacy &amp; Stock Control</h1>
          <p className="text-sm text-slate-500">
            Dispensing reduces stock instantly; items drop to LOW at their reorder level and are
            flagged when out of stock.
          </p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700">
          {lowStockCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              {lowStockCount} low / out-of-stock
            </span>
          ) : (
            "All stock levels OK"
          )}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Add Inventory Item">
          <AddItemForm />
        </Card>

        <Card title="Dispense to Encounter">
          {dispenseOptions.length > 0 && rows.length > 0 ? (
            <DispenseToTreatmentForm treatments={dispenseOptions} items={dispenseItems} />
          ) : (
            <EmptyState message="No active encounters to dispense to right now." />
          )}
        </Card>
      </div>

      <Card title="Stock Monitoring">
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Items at or below their reorder level are flagged LOW. Zero-stock items are flagged OUT OF
          STOCK. Use &ldquo;Adjust Stock&rdquo; to restock on arrival.
        </div>
        {rows.length === 0 ? (
          <EmptyState message="Add inventory items to begin monitoring stock." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">In stock</th>
                  <th className="py-2 pr-3 font-medium">Reorder at</th>
                  <th className="py-2 pr-3 font-medium">Unit cost</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-900">{i.item_name}</td>
                    <td className="py-2 pr-3 capitalize text-slate-600">{i.item_type}</td>
                    <td className="py-2 pr-3 font-semibold">{i.stock_quantity}</td>
                    <td className="py-2 pr-3 text-slate-600">{i.reorder_level}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatNaira(i.unit_cost_price)}</td>
                    <td className="py-2">
                      <Badge className={stockBadge(i.stock_status)}>
                        {i.stock_status === "OK" ? "OK" : i.stock_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Restock / Adjust Stock">
        {rows.length > 0 ? (
          <AdjustStockForm items={dispenseItems} />
        ) : (
          <EmptyState message="No items to adjust." />
        )}
      </Card>

      <Card title="Recent Dispensing Log (internal)">
        {logRows.length === 0 ? (
          <EmptyState message="No dispensations recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Patient</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Unit cost</th>
                  <th className="py-2 pr-3 font-medium">Line total</th>
                  <th className="py-2 pr-3 font-medium">Dispensed by</th>
                  <th className="py-2 font-medium">At</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((d, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-teal-700">{d.patient_code}</span>{" "}
                      {d.patient_name}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{d.item_name}</td>
                    <td className="py-2 pr-3">{d.quantity}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {formatNaira(d.unit_cost_snapshot)}
                    </td>
                    <td className="py-2 pr-3 font-semibold">
                      {formatNaira(d.quantity * d.unit_cost_snapshot)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{d.dispensed_by_name ?? "-"}</td>
                    <td className="py-2 text-slate-500">{formatDateTime(d.dispensed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}