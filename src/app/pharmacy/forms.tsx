"use client";

import { useActionState } from "react";
import { addItem, adjustStock, dispenseToTreatment } from "./actions";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";
import { encounterLabel } from "@/lib/utils";
import type { TreatmentOption, ItemOption } from "@/app/nurse/forms";

export function AddItemForm() {
  const [state, action] = useActionState(addItem, undefined);

  return (
    <form action={action} className="space-y-3">
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
}: {
  treatments: TreatmentOption[];
  items: ItemOption[];
}) {
  const [state, action] = useActionState(dispenseToTreatment, undefined);

  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      <Field label="Treatment">
        <select name="treatment_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select active encounter...
          </option>
          {treatments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patient_code} - {t.full_name} ({encounterLabel(t.encounter_type)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Item">
        <select name="item_id" required className={selectClass} defaultValue="">
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
      <Field label="Quantity">
        <input
          name="quantity"
          type="number"
          min={1}
          required
          className={inputClass}
          defaultValue={1}
        />
      </Field>
      <SubmitButton pendingLabel="Dispensing...">Dispense (reduces stock)</SubmitButton>
    </form>
  );
}

export function AdjustStockForm({ items }: { items: ItemOption[] }) {
  const [, action] = useActionState(adjustStock, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Item">
        <select name="item_id" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Select item...
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
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
  );
}