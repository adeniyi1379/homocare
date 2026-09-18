"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([]);
  const [handoff, setHandoff] = useState<"nurse" | "patient">("nurse");
  const [dispensedTo, setDispensedTo] = useState("");
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (submitted.current && !state?.error) onDone();
  }, [state, onDone]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inCart = new Set(lines.map((l) => l.item_id));
    return items.filter(
      (i) =>
        i.stock_quantity > 0 &&
        !inCart.has(i.id) &&
        (!q || i.item_name.toLowerCase().includes(q))
    );
  }, [query, lines, items]);

  const treatmentOptions = treatments.map((t) => ({
    id: t.id,
    primary: t.patient_code,
    secondary: t.full_name,
    detail: `${encounterLabel(t.encounter_type)} - ${t.id}`,
  }));

  const submitLines: DispenseLine[] = lines.map((l) => ({
    item_id: l.item_id,
    quantity: l.quantity,
    handoff,
    dispensed_to: handoff === "nurse" ? dispensedTo : "",
  }));

  function scheduleClose() {
    blurTimer.current = setTimeout(() => setShowResults(false), 150);
  }

  function cancelClose() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  function addItemToCart(item: ItemOption) {
    setLines((prev) => [...prev, { item_id: item.id, quantity: 1 }]);
    setQuery("");
    setShowResults(false);
    inputRef.current?.focus();
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item_id !== itemId));
  }

  function changeQty(itemId: string, delta: number) {
    const stock = itemsById.get(itemId)?.stock_quantity ?? 1;
    setLines((prev) =>
      prev.map((l) =>
        l.item_id === itemId
          ? { ...l, quantity: Math.min(stock, Math.max(1, l.quantity + delta)) }
          : l
      )
    );
  }

  function setQty(itemId: string, raw: number) {
    const stock = itemsById.get(itemId)?.stock_quantity ?? 1;
    const qty = Number.isFinite(raw) ? Math.min(stock, Math.max(1, Math.trunc(raw))) : 1;
    setLines((prev) => prev.map((l) => (l.item_id === itemId ? { ...l, quantity: qty } : l)));
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Hand entire dispense to
          </p>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm">
            <button
              type="button"
              onClick={() => setHandoff("nurse")}
              className={`px-3 py-1.5 font-semibold ${
                handoff === "nurse"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              To nurse 
            </button>
            <button
              type="button"
              onClick={() => setHandoff("patient")}
              className={`px-3 py-1.5 font-semibold ${
                handoff === "patient"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              To patient
            </button>
          </div>
          {handoff === "nurse" && (
            <select
              className={`${selectClass} h-9 w-auto min-w-0 flex-1 px-2 py-1`}
              value={dispensedTo}
              onChange={(e) => setDispensedTo(e.target.value)}
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
          )}
        </div>
      </div>
      <div>
        <Field label="Search item">
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                if (value.trim().length > 1) {
                  setShowResults(true);
                } else {
                  setShowResults(false);
                }
              }}
              onFocus={cancelClose}
              onBlur={scheduleClose}
              placeholder="Type an item name, then tap a result to add it..."
              className={inputClass}
              autoComplete="off"
            />
            {showResults && query.trim().length > 1 && (
              <ul
                className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                onMouseDown={cancelClose}
              >
                {suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">
                    {query.trim()
                      ? "No matching inventory items."
                      : "Type an item name to search the inventory."}
                  </li>
                ) : (
                  suggestions.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => addItemToCart(i)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-50"
                      >
                        <span className="truncate text-sm text-slate-800">{i.item_name}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {i.stock_quantity} in stock
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </Field>
        {/* <p className="text-xs text-slate-400">
          Tap a result to add it to the cart below. The search list closes so you can keep adding
          items or review what is in the cart.
        </p> */}
      </div>

  

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
          Cart is empty - search and add items above to build this dispense.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Items to dispense ({lines.length})
            </p>
            <button
              type="button"
              onClick={() => setLines([])}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Clear cart
            </button>
          </div>

          {lines.map((line) => {
            const item = itemsById.get(line.item_id);
            if (!item) return null;
            return (
              <div
                key={line.item_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {item.item_name}
                  </div>
                  <div className="text-xs text-slate-400">{item.stock_quantity} in stock</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(line.item_id, -1)}
                    aria-label={`Decrease quantity of ${item.item_name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    &minus;
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={item.stock_quantity}
                    required
                    value={line.quantity}
                    onChange={(e) => setQty(line.item_id, Number(e.target.value))}
                    className="h-7 w-14 rounded-md border border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={() => changeQty(line.item_id, 1)}
                    aria-label={`Increase quantity of ${item.item_name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.item_id)}
                  aria-label={`Remove ${item.item_name} from cart`}
                  className="shrink-0 text-slate-300 transition-colors hover:text-rose-600"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input type="hidden" name="lines" value={JSON.stringify(submitLines)} />
      {lines.length === 0 ? (
        <div className="text-center">
          <button
            type="submit"
            disabled
            className="btn btn-primary cursor-not-allowed opacity-60"
          >
            Dispense 0 items
          </button>
          <p className="mt-1 text-xs text-slate-400">Add at least one item above.</p>
        </div>
      ) : handoff === "nurse" && !dispensedTo ? (
        <div className="text-center">
          <button
            type="submit"
            disabled
            className="btn btn-primary cursor-not-allowed opacity-60"
          >
            Select a nurse to dispense
          </button>
          <p className="mt-1 text-xs text-slate-400">
            Choose the nurse this dispense is handed to above.
          </p>
        </div>
      ) : (
        <SubmitButton
          pendingLabel={`Dispensing ${lines.length} item${lines.length > 1 ? "s" : ""}...`}
        >
          Dispense {lines.length} item{lines.length > 1 ? "s" : ""} (reduces stock)
        </SubmitButton>
      )}
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