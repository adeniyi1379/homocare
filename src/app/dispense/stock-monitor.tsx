"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, inputClass } from "@/components/ui";
import { formatNaira, itemCategoryLabel, isStockedCategory, stockBadge } from "@/lib/utils";

export type StockRow = {
  id: string;
  item_name: string;
  category: string;
  stock_quantity: number;
  reorder_level: number;
  unit_cost_price: number | null;
  sell_price: number;
  stock_status: "LOW" | "OK" | "OUT OF STOCK";
};

export function StockMonitor({
  items,
  showCosts,
}: {
  items: StockRow[];
  showCosts: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | StockRow["stock_status"]>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (status !== "ALL" && i.stock_status !== status) return false;
      if (!q) return true;
      return (
        i.item_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        itemCategoryLabel(i.category).toLowerCase().includes(q)
      );
    });
  }, [query, status, items]);

  const statusFilter = (["ALL", "OUT OF STOCK", "LOW", "OK"] as const).map((s) => ({
    value: s,
    count: s === "ALL" ? items.length : items.filter((i) => i.stock_status === s).length,
  }));

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
          placeholder="Search items by name or category..."
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
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">In stock</th>
                <th className="py-2 pr-3 font-medium">Reorder at</th>
                <th className="py-2 pr-3 font-medium">Sell price</th>
                {showCosts && <th className="py-2 pr-3 font-medium">Unit cost</th>}
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
                    <Link
                      href={`/dispense/items/${i.id}`}
                      className="text-left font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-brand-700 hover:decoration-brand-400"
                    >
                      {i.item_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone="info">{itemCategoryLabel(i.category)}</Badge>
                  </td>
                  <td className={`py-2 pr-3 font-semibold ${isStockedCategory(i.category) && i.stock_quantity === 0 ? "text-red-600" : "text-slate-600"}`}>
                    {isStockedCategory(i.category) ? i.stock_quantity : "-"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {isStockedCategory(i.category) ? i.reorder_level : "-"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{formatNaira(i.sell_price)}</td>
                  {showCosts && (
                    <td className="py-2 pr-3 text-slate-600">
                      {formatNaira(i.unit_cost_price)}
                    </td>
                  )}
                  <td className="py-2">
                    <Badge className={stockBadge(i.stock_status)}>
                      {!isStockedCategory(i.category) ? "N/A" : i.stock_status === "OK" ? "OK" : i.stock_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}