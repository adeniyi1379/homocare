"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, inputClass } from "@/components/ui";
import { formatDateTime, formatNaira, stockBadge } from "@/lib/utils";
import { getItemUsage, type ItemUsageRow } from "./actions";

export type StockRow = {
  id: string;
  item_name: string;
  item_type: string;
  stock_quantity: number;
  reorder_level: number;
  unit_cost_price: number;
  stock_status: "LOW" | "OK" | "OUT OF STOCK";
};

export function StockMonitor({ items }: { items: StockRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | StockRow["stock_status"]>("ALL");
  const [activeItem, setActiveItem] = useState<StockRow | null>(null);
  const [usage, setUsage] = useState<ItemUsageRow[] | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (status !== "ALL" && i.stock_status !== status) return false;
      if (!q) return true;
      return (
        i.item_name.toLowerCase().includes(q) ||
        i.item_type.toLowerCase().includes(q)
      );
    });
  }, [query, status, items]);

  const statusFilter = (["ALL", "OUT OF STOCK", "LOW", "OK"] as const).map((s) => ({
    value: s,
    count: s === "ALL" ? items.length : items.filter((i) => i.stock_status === s).length,
  }));

  const totalDispensed =
    usage?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;
  const totalCost =
    usage?.reduce((sum, u) => sum + u.quantity * u.unit_cost_snapshot, 0) ?? 0;

  async function openUsage(item: StockRow) {
    setActiveItem(item);
    setUsage(null);
    setUsageError(null);
    setLoading(true);
    try {
      const res = await getItemUsage(item.id);
      if (res.error) setUsageError(res.error);
      else setUsage(res.rows ?? []);
    } catch (e) {
      setUsageError(e instanceof Error ? e.message : "Failed to load usage history.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return <EmptyState message="Add inventory items to begin monitoring stock." />;
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
          placeholder="Search items by name or type..."
          aria-label="Search inventory items"
        />
        <div className="flex flex-wrap gap-1">
          {statusFilter.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                status === s.value
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.value === "ALL" ? "All" : s.value}
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
                  status === s.value ? "bg-white/20 text-white" : "bg-white text-slate-500"
                }`}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {items.length} items
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          message={
            query
              ? `No items match "${query}"${status !== "ALL" ? ` with status ${status}` : ""}.`
              : status !== "ALL"
                ? `No items with status ${status}.`
                : "No items to show."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern w-full text-left text-sm">
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
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="group border-b border-slate-100 transition-colors hover:bg-brand-50/60"
                >
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => openUsage(i)}
                      className="text-left font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-brand-700 hover:decoration-brand-400"
                    >
                      {i.item_name}
                    </button>
                  </td>
                  <td className="py-2 pr-3 capitalize text-slate-600">{i.item_type}</td>
                  <td className={`py-2 pr-3 font-semibold ${i.stock_quantity === 0 ? "text-red-600" : ""}`}>
                    {i.stock_quantity}
                  </td>
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

      <Modal
        open={activeItem !== null}
        title={activeItem?.item_name ?? "Item usage"}
        onClose={() => {
          setActiveItem(null);
          setUsage(null);
          setUsageError(null);
        }}
      >
        {activeItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className={stockBadge(activeItem.stock_status)}>
                {activeItem.stock_status === "OK" ? "OK" : activeItem.stock_status}
              </Badge>
              <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700">
                {activeItem.item_type}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                {activeItem.stock_quantity} in stock · reorder at {activeItem.reorder_level}
              </span>
            </div>

            {loading && <p className="text-sm text-slate-500">Loading usage history...</p>}

            {!loading && usageError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{usageError}</p>
            )}

            {!loading && !usageError && usage && usage.length === 0 && (
              <EmptyState message="No dispensations recorded for this item yet." />
            )}

            {!loading && !usageError && usage && usage.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="table-modern w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3 font-medium">Patient</th>
                        <th className="py-2 pr-3 font-medium">Encounter</th>
                        <th className="py-2 pr-3 font-medium">Qty</th>
                        <th className="py-2 pr-3 font-medium">Unit cost</th>
                        <th className="py-2 pr-3 font-medium">Line total</th>
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
                            <span className="font-mono text-xs text-brand-600">
                              {u.patient_code}
                            </span>{" "}
                            {u.patient_name}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{u.encounter_label}</td>
                          <td className="py-2 pr-3 font-semibold">{u.quantity}</td>
                          <td className="py-2 pr-3 text-slate-600">
                            {formatNaira(u.unit_cost_snapshot)}
                          </td>
                          <td className="py-2 pr-3 font-semibold">
                            {formatNaira(u.quantity * u.unit_cost_snapshot)}
                          </td>
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
                              <Badge className="bg-violet-100 text-violet-700">
                                With patient
                              </Badge>
                            ) : u.administered_by_name ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                Given ({u.administered_by_name})
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                            )}
                          </td>
                          <td className="py-2 text-slate-500">{formatDateTime(u.dispensed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
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
                  </table>
                </div>
                <p className="text-xs text-slate-400">
                  Costs shown are internal purchase costs - never exposed on receipts or cashier
                  views.
                </p>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}