import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DispenseActions } from "./dispense-actions";
import { DispenseBranchSwitch } from "./branch-switch";
import { StockMonitor } from "./stock-monitor";
import { DispenseLog, type DispenseLogRow } from "./dispense-log";
import type { TreatmentOption } from "@/app/nurse/forms";
import type { RestockItemOption } from "./forms";
import { Card, Badge, PageHeader } from "@/components/ui";
import { oneOrNull, itemCategoryLabel, isStockedCategory } from "@/lib/utils";

export const dynamic = "force-dynamic";

export type BranchOption = { id: string; name: string; code: string };

type StockRow = {
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

type TreatmentRow = {
  id: string;
  encounter_type: string;
  category: string | null;
  status: string;
  branch_id: string | null;
  patients:
    | { id: string; patient_code: string; full_name: string }
    | { id: string; patient_code: string; full_name: string }[];
};

type LogRow = DispenseLogRow & { treatment_id: string; branch_id: string | null };

export default async function DispensePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch } = await searchParams;
  const current = await requireRole(["dispenser", "nurse", "admin"]);
  const showCosts = current.profile.role === "dispenser" || current.profile.role === "admin";
  const canChangeCost = showCosts;
  const isAdmin = current.profile.role === "admin";

  const supabase = await createClient();

  const [
    { data: branchRows },
    { data: stock },
    { data: treatments },
    { data: log },
    { data: rawRecipients },
    { data: logTreatments },
  ] = await Promise.all([
    isAdmin
      ? supabase.from("branches").select("id, name, code").order("name", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    supabase.from("v_stock_status").select("id, item_name, category, stock_quantity, reorder_level, unit_cost_price, sell_price, stock_status, branch_id"),
    supabase
      .from("treatments")
      .select("id, encounter_type, category, status, branch_id, patients(id, patient_code, full_name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("get_pharmacy_log", { limit_count: 300 }),
    supabase.from("profiles").select("id, full_name, role, branch_id").eq("role", "nurse").order("full_name", { ascending: true }),
    supabase.from("treatments").select("id, branch_id"),
  ]);

  const branchOptions = (isAdmin ? branchRows ?? [] : []) as BranchOption[];
  const activeBranchId =
    isAdmin && branch && branchOptions.some((b) => b.id === branch) ? branch : null;

  const branchScope = (branchId: string | null) => !activeBranchId || branchId === activeBranchId;

  const rows = ((stock ?? []) as StockRow[]).filter((r) => branchScope(r.branch_id));
  const priority = { "OUT OF STOCK": 0, LOW: 1, OK: 2 } as const;
  rows.sort(
    (a, b) =>
      (priority[a.stock_status] ?? 9) - (priority[b.stock_status] ?? 9) ||
      a.item_name.localeCompare(b.item_name)
  );

  const lowStockCount = rows.filter((r) => r.stock_status !== "OK").length;

  const treatmentsList = (treatments ?? []).filter((t) => branchScope(t.branch_id)) as TreatmentRow[];
  const dispenseOptions: TreatmentOption[] = treatmentsList
    .filter((t) => t.status === "active")
    .map((t) => ({
      id: t.id,
      patient_code: oneOrNull(t.patients)?.patient_code ?? "",
      full_name: oneOrNull(t.patients)?.full_name ?? "Unknown patient",
      encounter_type: t.encounter_type,
      branch_id: t.branch_id,
    }));

  const dispenseItems = rows.map((i) => ({
    id: i.id,
    item_name: i.item_name,
    category: i.category,
    stock_quantity: i.stock_quantity,
    sell_price: i.sell_price,
    branch_id: i.branch_id,
  }));

  const restockItems: RestockItemOption[] = rows.map((i) => ({
    id: i.id,
    item_name: i.item_name,
    category: i.category,
    stock_quantity: i.stock_quantity,
    sell_price: i.sell_price,
    unit_cost_price: i.unit_cost_price,
    branch_id: i.branch_id,
  }));

  type RecipientRow = { id: string; full_name: string; role: string; branch_id: string | null };
  const recipients = ((rawRecipients ?? []) as RecipientRow[]).filter((r) =>
    branchScope(r.branch_id)
  );

  const branchById = new Map(
    ((logTreatments ?? []) as { id: string; branch_id: string | null }[]).map((t) => [
      t.id,
      t.branch_id,
    ])
  );
  const logRows = ((log ?? []) as LogRow[])
    .map((r) => ({ ...r, branch_id: r.branch_id ?? branchById.get(r.treatment_id) ?? null }))
    .filter((r) => branchScope(r.branch_id));

  const categories = Array.from(new Set(rows.map((r) => r.category))).map((c) => itemCategoryLabel(c));

  return (
    <div className="space-y-6">
      <PageHeader title="Dispense &amp; Stock Control">
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

      {isAdmin && (
        <Card>
          <DispenseBranchSwitch branches={branchOptions} current={activeBranchId} />
        </Card>
      )}

      <Card title="Quick Actions">
        <DispenseActions
          treatments={dispenseOptions}
          items={dispenseItems}
          restockItems={restockItems}
          recipients={recipients}
          branches={branchOptions}
          isAdmin={isAdmin}
          defaultBranchId={activeBranchId}
          showCosts={showCosts}
          canChangeCost={canChangeCost}
        />
      </Card>

      <Card title="Stock Monitoring">
        <StockMonitor
          items={rows.filter((r) => isStockedCategory(r.category))}
          showCosts={showCosts}
        />
      </Card>

      <Card title="Recent Dispensing Log (internal)">
        <DispenseLog
          rows={logRows.filter((r) => isStockedCategory(r.category))}
          showCosts={showCosts}
        />
      </Card>
    </div>
  );
}