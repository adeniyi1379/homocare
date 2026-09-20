"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { AddItemForm, DispenseToTreatmentForm, AdjustStockForm } from "./forms";
import type { RestockItemOption } from "./forms";
import type { BranchOption } from "./page";
import type { TreatmentOption, ItemOption } from "@/app/nurse/forms";
import type { StaffRecipient } from "./actions";

const TILES = [
  {
    id: "add" as const,
    filled: true,
    glyph: "+",
    title: "Add Inventory Item",
    subtitle: "Add a drug, injection or charge-only service with its sell price.",
  },
  {
    id: "dispense" as const,
    filled: false,
    glyph: "\u2192",
    title: "Dispense to Encounter",
    subtitle: "Bill medication / services against an active encounter.",
  },
  {
    id: "adjust" as const,
    filled: false,
    glyph: "\u21BA",
    title: "Restock / Adjust Stock",
    subtitle: "Record stock received or correct a miscounted balance / price.",
  },
];

export function DispenseActions({
  treatments,
  items,
  restockItems,
  recipients,
  branches,
  isAdmin,
  defaultBranchId,
  showCosts,
  canChangeCost,
}: {
  treatments: TreatmentOption[];
  items: ItemOption[];
  restockItems: RestockItemOption[];
  recipients: StaffRecipient[];
  branches: BranchOption[];
  isAdmin: boolean;
  defaultBranchId: string | null;
  showCosts: boolean;
  canChangeCost: boolean;
}) {
  const [active, setActive] = useState<"add" | "dispense" | "adjust" | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => setActive(tile.id)}
            className="group flex flex-col items-start rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.26)]"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl font-display text-xl font-bold leading-none shadow-md transition-transform group-hover:scale-105 ${
                tile.filled
                  ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-900/20"
                  : "border border-brand-200 bg-brand-50/60 text-brand-700 shadow-none group-hover:bg-brand-50"
              }`}
            >
              {tile.glyph}
            </span>
            <span className="mt-3 font-display text-lg font-bold text-slate-900">
              {tile.title}
            </span>
            <span className="mt-1 text-sm text-slate-500">{tile.subtitle}</span>
          </button>
        ))}
      </div>

      <Modal open={active === "add"} title="Add Inventory Item" onClose={() => setActive(null)}>
        <AddItemForm
          branches={branches}
          isAdmin={isAdmin}
          defaultBranchId={defaultBranchId}
          onDone={() => setActive(null)}
        />
      </Modal>

      <Modal
        open={active === "dispense"}
        title="Dispense to Encounter"
        onClose={() => setActive(null)}
      >
        {treatments.length > 0 && items.length > 0 ? (
          <DispenseToTreatmentForm
            treatments={treatments}
            items={items}
            recipients={recipients}
            onDone={() => setActive(null)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            {treatments.length === 0
              ? "No active encounters to dispense to in this branch right now."
              : "No inventory items in this branch yet."}
          </p>
        )}
      </Modal>

      <Modal open={active === "adjust"} title="Restock / Adjust Stock" onClose={() => setActive(null)}>
        {restockItems.length > 0 ? (
          <AdjustStockForm
            items={restockItems}
            canChangeCost={canChangeCost}
            onDone={() => setActive(null)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            No items to adjust in this branch yet. Add inventory items first.
          </p>
        )}
      </Modal>
    </>
  );
}