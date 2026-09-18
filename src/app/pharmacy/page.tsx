import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PharmacyActions } from "./pharmacy-actions";
import { StockMonitor } from "./stock-monitor";
import { DispenseLog, type DispenseLogRow } from "./dispense-log";
import type { TreatmentOption } from "@/app/nurse/forms";
import type { RestockItemOption } from "./forms";
import { Card, Badge, PageHeader } from "@/components/ui";
import { oneOrNull } from "@/lib/utils";

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

  const [{ data: stock }, { data: treatments }, { data: log }, { data: rawRecipients }] =
    await Promise.all([
      supabase.from("v_stock_status").select("*"),
      supabase
        .from("treatments")
        .select("id, encounter_type, category, status, patients(id, patient_code, full_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.rpc("get_pharmacy_log", { limit_count: 300 }),
      supabase.rpc("get_dispense_recipients"),
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

  const restockItems: RestockItemOption[] = rows.map((i) => ({
    id: i.id,
    item_name: i.item_name,
    item_type: i.item_type,
    stock_quantity: i.stock_quantity,
    unit_cost_price: i.unit_cost_price,
  }));

  type RecipientRow = { id: string; full_name: string; role: string };
  const recipients = (rawRecipients ?? []) as RecipientRow[];

  const logRows = (log ?? []) as DispenseLogRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy &amp; Stock Control"
        // subtitle="Dispensing reduces stock instantly; items drop to LOW at their reorder level and are flagged when out of stock."
      >
        <Badge tone={lowStockCount > 0 ? "warning" : "info"}>
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
      </PageHeader>

      <Card title="Quick Actions">
        <PharmacyActions treatments={dispenseOptions} items={dispenseItems} restockItems={restockItems} recipients={recipients} />
      </Card>

<Card title="Stock Monitoring">
        {/* <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Items at or below their reorder level are flagged LOW. Zero-stock items are flagged OUT OF
          STOCK. Use &ldquo;Restock / Adjust Stock&rdquo; to restock on arrival. Click any item to
          inspect its dispensing history.
        </div> */}
        <StockMonitor items={rows} />
      </Card>

      <Card title="Recent Dispensing Log (internal)">
        {/* <div className="mb-3 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-brand-800">
          Search by item name, patient (name or code), or the staff member the item was handed to.
          Internal purchase costs only - never on receipts or cashier views.
        </div> */}
        <DispenseLog rows={logRows} />
      </Card>
    </div>
  );
}