"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { addItem, adjustStock, changeItemCost, dispenseBatch } from "./actions";
import type { DispenseLine } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { SearchPicker } from "@/components/search-picker";
import { formatNaira, encounterLabel } from "@/lib/utils";
import type { TreatmentOption, ItemOption } from "@/app/nurse/forms";
import type { StaffRecipient } from "./actions";

export type RestockItemOption = ItemOption & { unit_cost_price: number };

export function AddItemForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(addItem, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !state?.error) onDone();
  }, [state, onDone]);

  return (
    <form
      action={(fd) => {
        submitted.current = true;
        action(fd);
      }}
      className="space-y-3"
    >
      <FormError message={state?.error} />
      <Field label="Item name">
        <input
          name="item_name"
          required
          className={inputClass}
          placeholder="e.g. Paracetamol 500mg"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select name="item_type" className={selectClass} defaultValue="tablet">
            <option value="tablet">Tablet</option>
            <option value="syrup">Syrup</option>
            <option value="injection">Injection</option>
            <option value="consumable">Consumable</option>
          </select>
        </Field>
        <Field label="Unit cost (internal)">
          <input
            name="unit_cost_price"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputClass}
            placeholder="0.00"
          />
        </Field>
        <Field label="Opening stock">
          <input
            name="stock_quantity"
            type="number"
            min="0"
            className={inputClass}
            defaultValue={0}
          />
        </Field>
        <Field label="Reorder level">
          <input
            name="reorder_level"
            type="number"
            min="0"
            className={inputClass}
            defaultValue={10}
          />
        </Field>
      </div>
      <p className="text-xs text-slate-400">
        Purchase cost is internal only - it never appears on patient receipts or cashier views.
      </p>
      <SubmitButton pendingLabel="Adding...">Add Item</SubmitButton>
    </form>
  );
}

export function DispenseToTreatmentForm({
  treatments,
  items,
  recipients,
  onDone,
}: {
  treatments: TreatmentOption[];
  items: ItemOption[];
  recipients: StaffRecipient[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(dispenseBatch, undefined);
  const submitted = useRef(false);
  const [lines, setLines] = useState<DispenseLine[]>([
    { handoff: "nurse", item_id: "", quantity: 1, dispensed_to: "" },
  ]);

  useEffect(() => {
    if (submitted.current && !state?.error) onDone();
  }, [state, onDone]);

  const treatmentOptions = treatments.map((t) => ({
    id: t.id,
    primary: t.patient_code,
    secondary: t.full_name,
    detail: `${encounterLabel(t.encounter_type)} - ${t.id}`,
  }));

  function updateLine(index: number, patch: Partial<DispenseLine>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { handoff: "nurse", item_id: "", quantity: 1, dispensed_to: "" },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      action={(fd) => {
        submitted.current = true;
        action(fd);
      }}
      className="space-y-4"
    >
      <FormError message={state?.error} />
      <Field label="Treatment">
        <SearchPicker
          options={treatmentOptions}
          name="treatment_id"
          placeholder="Type patient name or ID, then select the encounter..."
          emptyText="No matching active encounters."
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Items to dispense
          </p>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            + Add item
          </button>
        </div>

        {lines.map((line, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Item {index + 1}
              </p>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Remove
                </button>
              )}
            </div>

            <Field label="Item">
              <select
                name={`line_${index}_item`}
                required
                className={selectClass}
                value={line.item_id}
                onChange={(e) => updateLine(index, { item_id: e.target.value })}
              >
                <option value="" disabled>
                  Select item...
                </option>
                {items.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.stock_quantity === 0}>
                    {i.item_name} ({i.stock_quantity} in stock)
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Hand off to</p>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => updateLine(index, { handoff: "nurse", dispensed_to: "" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    line.handoff === "nurse"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  To nurse (ward)
                </button>
                <button
                  type="button"
                  onClick={() => updateLine(index, { handoff: "patient", dispensed_to: "" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    line.handoff === "patient"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  To patient (take home)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              {line.handoff === "nurse" ? (
                <Field label="Hand off to (nurse)">
                  <select
                    name={`line_${index}_to`}
                    required
                    className={selectClass}
                    value={line.dispensed_to}
                    onChange={(e) =>
                      updateLine(index, { dispensed_to: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      Select nurse...
                    </option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Recipient">
                  <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700">
                    Given to the patient directly — they take it home.
                  </p>
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>

      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <SubmitButton pendingLabel={`Dispensing ${lines.length} item${lines.length > 1 ? "s" : ""}...`}>
        Dispense {lines.length} item{lines.length > 1 ? "s" : ""} (reduces stock)
      </SubmitButton>
      <p className="text-xs text-slate-400">
        Each row is tracked with who it was handed to: a nurse (for ward administration)
        or the patient directly (take home). Stock drops instantly for every row.
      </p>
    </form>
  );
}

export function AdjustStockForm({
  items,
  onDone,
}: {
  items: RestockItemOption[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"quantity" | "cost">("quantity");
  const [stockState, stockAction] = useActionState(adjustStock, undefined);
  const [costState, costAction] = useActionState(changeItemCost, undefined);
  const stockSubmitted = useRef(false);
  const costSubmitted = useRef(false);

  useEffect(() => {
    if (
      (stockSubmitted.current && !stockState?.error) ||
      (costSubmitted.current && !costState?.error)
    ) {
      onDone();
    }
  }, [stockState, costState, onDone]);

  const options = items.map((i) => ({
    id: i.id,
    item_name: i.item_name,
    stock_quantity: i.stock_quantity,
    unit_cost_price: i.unit_cost_price,
  }));

  const current =
    mode === "cost"
      ? options.find(
          (o) => o.id === (document.querySelector<HTMLSelectElement>('[name="cost_item_id"]')?.value ?? "")
        )
      : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("quantity")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "quantity" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Adjust quantity
        </button>
        <button
          type="button"
          onClick={() => setMode("cost")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            mode === "cost" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Change unit cost
        </button>
      </div>

      {mode === "quantity" ? (
        <form
          action={(fd) => {
            stockSubmitted.current = true;
            stockAction(fd);
          }}
          className="space-y-3"
        >
          <FormError message={stockState?.error} />
          <Field label="Item">
            <select name="item_id" required className={selectClass} defaultValue="">
              <option value="" disabled>
                Select item...
              </option>
              {options.map((i) => (
                <option key={i.id} value={i.id} disabled={i.stock_quantity === 0}>
                  {i.item_name} ({i.stock_quantity} in stock)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity change (+ restock / - usage)">
            <input
              name="delta"
              type="number"
              required
              className={inputClass}
              placeholder="e.g. 20"
            />
          </Field>
          <SubmitButton pendingLabel="Updating...">Update Stock</SubmitButton>
        </form>
      ) : (
        <form
          action={(fd) => {
            costSubmitted.current = true;
            costAction(fd);
          }}
          className="space-y-3"
        >
          <FormError message={costState?.error} />
          <Field label="Item">
            <select name="cost_item_id" required className={selectClass} defaultValue="">
              <option value="" disabled>
                Select item...
              </option>
              {options.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_name} - current {formatNaira(i.unit_cost_price)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New unit cost (internal)">
            <input
              name="unit_cost_price"
              type="number"
              step="0.01"
              min="0"
              required
              className={inputClass}
              placeholder="0.00"
            />
          </Field>
          <p className="text-xs text-slate-400">
            Applies going forward; already-dispensed lines keep their original snapshot cost.
          </p>
          <SubmitButton pendingLabel="Updating...">Update Unit Cost</SubmitButton>
        </form>
      )}
    </div>
  );
}